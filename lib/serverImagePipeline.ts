import type { FeatureKey } from "@/lib/entitlements";
import { recordServerImageUsage, type LimitResult } from "@/lib/imageLimits";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createSignedImageUrl, sha256Hex, uploadPngBase64 } from "@/lib/imageStorage";
import { buildFinalPrompt, resolveServerDimensions } from "@/lib/serverImageConfig";
import { callTxt2Img } from "@/lib/serverImageEngine";
import type { Database } from "@/types/supabase";

type CachedAssetRow = Pick<
  Database["public"]["Tables"]["image_generation_assets"]["Row"],
  "storage_bucket" | "storage_path" | "width" | "height" | "created_at"
>;

export type ServerImageSuccess = {
  imageBase64: string;
  width: number;
  height: number;
  steps: number;
  storageWarning?: string;
  usage: {
    usedToday: number;
    dailyLimit: number;
    usedMonth: number;
    monthlyLimit: number;
  };
};

export async function findCachedServerImage(opts: {
  nickname: string;
  featureKey: FeatureKey;
  prompt: string;
  negativePrompt: string;
}) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const promptHash = sha256Hex(`${opts.featureKey}::${opts.prompt}::${opts.negativePrompt}`);
  try {
    const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: cached } = await admin
      .from("image_generation_assets")
      .select("storage_bucket, storage_path, width, height, created_at")
      .eq("nickname", opts.nickname)
      .eq("feature_key", opts.featureKey)
      .eq("prompt_hash", promptHash)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const hit = cached as CachedAssetRow | null;
    if (!hit?.storage_bucket || !hit.storage_path) return null;
    const signedUrl = await createSignedImageUrl(hit.storage_bucket, hit.storage_path, 60 * 10);
    return {
      cached: true as const,
      url: signedUrl,
      storage: { bucket: hit.storage_bucket, path: hit.storage_path },
      width: hit.width,
      height: hit.height,
      created_at: hit.created_at,
      promptHash,
    };
  } catch {
    return null;
  }
}

export async function runServerImageGeneration(opts: {
  nickname: string;
  featureKey: FeatureKey;
  prompt: string;
  negativePrompt: string;
  engineUrl: string;
  width?: number;
  height?: number;
  steps?: number;
  recordUsage?: boolean;
}): Promise<
  | { ok: true; result: ServerImageSuccess; promptHash: string }
  | { ok: false; error: string; timedOut?: boolean; engineStatus?: number; engineError?: unknown }
> {
  const dims = resolveServerDimensions(opts.featureKey, {
    width: opts.width,
    height: opts.height,
    steps: opts.steps,
  });
  const finalPrompt = buildFinalPrompt(opts.featureKey, opts.prompt);
  const promptHash = sha256Hex(`${opts.featureKey}::${opts.prompt}::${opts.negativePrompt}`);

  const engine = await callTxt2Img({
    engineUrl: opts.engineUrl,
    prompt: finalPrompt,
    negativePrompt: opts.negativePrompt || undefined,
    width: dims.width,
    height: dims.height,
    steps: dims.steps,
  });

  if (!engine.ok) {
    return {
      ok: false,
      error: engine.error,
      timedOut: engine.timedOut,
      engineStatus: engine.engineStatus,
      engineError: engine.engineError,
    };
  }

  let usage: LimitResult = {
    allowed: true,
    usedToday: 0,
    dailyLimit: 0,
    usedMonth: 0,
    monthlyLimit: 0,
  };
  if (opts.recordUsage !== false) {
    usage = await recordServerImageUsage({
      nickname: opts.nickname,
      featureKey: opts.featureKey,
    });
    if (!usage.allowed) {
      return { ok: false, error: usage.message };
    }
  }

  const admin = getSupabaseAdmin();
  let storageWarning: string | undefined;
  if (admin) {
    const up = await uploadPngBase64({
      nickname: opts.nickname,
      base64: engine.imageBase64,
      featureKey: opts.featureKey,
    });
    if (up.ok) {
      const ins = await admin.from("image_generation_assets").insert({
        nickname: opts.nickname,
        feature_key: opts.featureKey,
        mode: "server",
        prompt: opts.prompt,
        negative_prompt: opts.negativePrompt || null,
        prompt_hash: promptHash,
        width: dims.width,
        height: dims.height,
        steps: dims.steps,
        storage_bucket: up.bucket,
        storage_path: up.path,
        engine: "sd_webui",
        engine_meta: { engineUrl: opts.engineUrl.slice(0, 200), cached: false },
      } as never);
      if (ins.error) {
        storageWarning =
          "이미지는 준비되었어요. 기록 보관에 잠시 반영이 늦을 수 있어요. 아래에서 다운로드로 저장해 두시면 안전해요.";
      }
    } else {
      storageWarning =
        "이미지는 만들어졌어요. 온라인 보관은 설정 점검이 필요할 수 있어요. 다운로드로 저장해 두시면 됩니다.";
    }
  }

  return {
    ok: true,
    promptHash,
    result: {
      imageBase64: engine.imageBase64,
      width: dims.width,
      height: dims.height,
      steps: dims.steps,
      storageWarning,
      usage: {
        usedToday: usage.usedToday,
        dailyLimit: usage.dailyLimit,
        usedMonth: usage.usedMonth,
        monthlyLimit: usage.monthlyLimit,
      },
    },
  };
}
