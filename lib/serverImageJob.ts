import type { FeatureKey } from "@/lib/entitlements";
import type { ImageProvider } from "@/lib/serverImageProvider";
import { getServerImageConfig } from "@/lib/serverImageConfig";
import { findCachedServerImage, runServerImageGeneration } from "@/lib/serverImagePipeline";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createSignedImageUrl, sha256Hex } from "@/lib/imageStorage";
import { releaseImageLock } from "@/lib/imageLock";
import type { Database } from "@/types/supabase";

export type ImageJobStatus = "pending" | "running" | "done" | "failed";

type JobRow = Database["public"]["Tables"]["image_generation_jobs"]["Row"];

export async function createServerImageJob(opts: {
  nickname: string;
  featureKey: FeatureKey;
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  steps: number;
}) {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false as const, error: "DB 연결을 사용할 수 없습니다." };

  const promptHash = sha256Hex(`${opts.featureKey}::${opts.prompt}::${opts.negativePrompt}`);
  const { data, error } = await admin
    .from("image_generation_jobs")
    .insert({
      nickname: opts.nickname,
      feature_key: opts.featureKey,
      status: "pending",
      prompt: opts.prompt,
      negative_prompt: opts.negativePrompt || null,
      prompt_hash: promptHash,
      width: opts.width,
      height: opts.height,
      steps: opts.steps,
    } as never)
    .select("id, status, width, height, steps, created_at")
    .single();

  if (error || !data) {
    return { ok: false as const, error: error?.message ?? "작업 생성에 실패했습니다." };
  }

  const row = data as Pick<JobRow, "id" | "status" | "width" | "height" | "steps" | "created_at">;
  return { ok: true as const, job: row };
}

export async function getServerImageJob(jobId: string, nickname: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data } = await admin
    .from("image_generation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("nickname", nickname)
    .maybeSingle();
  return (data ?? null) as JobRow | null;
}

async function markJob(
  jobId: string,
  patch: Partial<{
    status: ImageJobStatus;
    error_message: string | null;
    storage_bucket: string | null;
    storage_path: string | null;
    result_width: number | null;
    result_height: number | null;
  }>
) {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  await admin
    .from("image_generation_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() } as never)
    .eq("id", jobId);
}

export async function processServerImageJob(opts: {
  job: JobRow;
  provider: ImageProvider;
  engineUrl?: string;
  nickname: string;
}) {
  const cfg = getServerImageConfig();
  const { job, provider, engineUrl, nickname } = opts;

  if (job.status === "done") {
    if (job.storage_bucket && job.storage_path) {
      const url = await createSignedImageUrl(job.storage_bucket, job.storage_path, 60 * 10);
      return {
        status: "done" as const,
        url,
        width: job.result_width,
        height: job.result_height,
      };
    }
    return { status: "failed" as const, error: "완료된 작업이지만 결과 파일이 없습니다." };
  }

  if (job.status === "failed") {
    return { status: "failed" as const, error: job.error_message ?? "생성에 실패했습니다." };
  }

  const updatedAt = new Date(job.updated_at).getTime();
  const stale =
    job.status === "running" && Number.isFinite(updatedAt) && Date.now() - updatedAt > cfg.jobStaleMs;

  if (job.status === "running" && !stale) {
    return { status: "running" as const };
  }

  const admin = getSupabaseAdmin();
  if (!admin) return { status: "failed" as const, error: "DB 연결을 사용할 수 없습니다." };

  const claim = await admin
    .from("image_generation_jobs")
    .update({ status: "running", updated_at: new Date().toISOString(), error_message: null } as never)
    .eq("id", job.id)
    .in("status", stale ? ["pending", "running"] : ["pending"])
    .select("id")
    .maybeSingle();

  if (!claim.data) {
    const fresh = await getServerImageJob(job.id, nickname);
    if (!fresh) return { status: "failed" as const, error: "작업을 찾을 수 없습니다." };
    if (fresh.status === "done" && fresh.storage_bucket && fresh.storage_path) {
      const url = await createSignedImageUrl(fresh.storage_bucket, fresh.storage_path, 60 * 10);
      return { status: "done" as const, url, width: fresh.result_width, height: fresh.result_height };
    }
    if (fresh.status === "failed") {
      return { status: "failed" as const, error: fresh.error_message ?? "생성에 실패했습니다." };
    }
    return { status: "running" as const };
  }

  const cached = await findCachedServerImage({
    nickname,
    featureKey: job.feature_key as FeatureKey,
    prompt: job.prompt,
    negativePrompt: job.negative_prompt ?? "",
  });

  if (cached?.url && cached.storage) {
    await markJob(job.id, {
      status: "done",
      storage_bucket: cached.storage.bucket,
      storage_path: cached.storage.path,
      result_width: cached.width ?? job.width,
      result_height: cached.height ?? job.height,
      error_message: null,
    });
    await releaseImageLock(nickname);
    return {
      status: "done" as const,
      cached: true,
      url: cached.url,
      width: cached.width,
      height: cached.height,
    };
  }

  const gen = await runServerImageGeneration({
    nickname,
    featureKey: job.feature_key as FeatureKey,
    prompt: job.prompt,
    negativePrompt: job.negative_prompt ?? "",
    provider,
    engineUrl,
    width: job.width,
    height: job.height,
    steps: job.steps,
    recordUsage: true,
  });

  if (!gen.ok) {
    await markJob(job.id, {
      status: "failed",
      error_message: gen.error,
    });
    await releaseImageLock(nickname);
    return {
      status: "failed" as const,
      error: gen.error,
      timedOut: gen.timedOut,
    };
  }

  const admin2 = getSupabaseAdmin();
  let bucket: string | null = null;
  let path: string | null = null;
  if (admin2) {
    const { data: asset } = await admin2
      .from("image_generation_assets")
      .select("storage_bucket, storage_path")
      .eq("nickname", nickname)
      .eq("feature_key", job.feature_key)
      .eq("prompt_hash", gen.promptHash)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const a = asset as { storage_bucket?: string; storage_path?: string } | null;
    bucket = a?.storage_bucket ?? null;
    path = a?.storage_path ?? null;
  }

  await markJob(job.id, {
    status: "done",
    storage_bucket: bucket,
    storage_path: path,
    result_width: gen.result.width,
    result_height: gen.result.height,
    error_message: null,
  });
  await releaseImageLock(nickname);

  return {
    status: "done" as const,
    imageBase64: gen.result.imageBase64,
    width: gen.result.width,
    height: gen.result.height,
    steps: gen.result.steps,
    storageWarning: gen.result.storageWarning,
    usage: gen.result.usage,
    url: bucket && path ? await createSignedImageUrl(bucket, path, 60 * 10) : null,
  };
}
