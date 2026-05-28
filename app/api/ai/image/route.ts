import { NextRequest, NextResponse } from "next/server";
import { isFeatureEnabledForNickname, type FeatureKey, normalizeNickname } from "@/lib/entitlements";
import { checkServerImageUsage } from "@/lib/imageLimits";
import { acquireImageLock, releaseImageLock } from "@/lib/imageLock";
import { verifyParticipantAuthHash } from "@/lib/participantAuth";
import { findCachedServerImage, runServerImageGeneration } from "@/lib/serverImagePipeline";
import { getServerImageConfig, resolveServerDimensions } from "@/lib/serverImageConfig";
import { createServerImageJob } from "@/lib/serverImageJob";
import {
  providerConfigError,
  providerDisplayName,
  resolveImageProvider,
} from "@/lib/serverImageProvider";

/** Vercel Hobby 기본 상한(초). Pro에서는 플랫폼이 더 길게 허용할 수 있음 */
export const maxDuration = 10;

type Body = {
  nickname?: string;
  authHash?: string;
  featureKey?: FeatureKey;
  prompt?: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  /** true: 동기(한 요청에 엔진 호출). false/생략: IMAGE_SERVER_ASYNC 기본값 */
  sync?: boolean;
  async?: boolean;
};

/**
 * 서버 이미지 생성 (유료/승인)
 * - IMAGE_SERVER_ASYNC=true(기본): jobId 반환 → GET /api/ai/image/jobs/[id] 폴링
 * - sync=true: 한 요청 안에서 생성(해상도·steps·타임아웃 자동 축소)
 */
export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const rawNick = String(body.nickname ?? "").trim().slice(0, 20);
  const nickname = normalizeNickname(body.nickname ?? "");
  const authHash = String(body.authHash ?? "").trim();
  const featureKey = body.featureKey;
  const prompt = String(body.prompt ?? "").trim();
  const negativePrompt = String(body.negativePrompt ?? "").trim();

  if (!nickname || !rawNick) return NextResponse.json({ error: "닉네임이 필요합니다." }, { status: 400 });
  if (!authHash) {
    return NextResponse.json(
      { error: "내 기록 보기에서 닉네임·비밀번호 조회 후에만 서버 생성을 사용할 수 있습니다.", requiresAuth: true },
      { status: 401 }
    );
  }
  const authed = await verifyParticipantAuthHash(rawNick, authHash);
  if (!authed) {
    return NextResponse.json({ error: "인증에 실패했습니다. 비밀번호를 확인해 주세요.", requiresAuth: true }, { status: 401 });
  }

  if (!featureKey) return NextResponse.json({ error: "featureKey가 필요합니다." }, { status: 400 });
  if (!prompt) return NextResponse.json({ error: "프롬프트가 필요합니다." }, { status: 400 });

  const provider = resolveImageProvider();
  const providerErr = providerConfigError(provider);
  if (providerErr) {
    return NextResponse.json({ error: providerErr, provider }, { status: 503 });
  }
  const engineUrl = (process.env.IMAGE_ENGINE_URL ?? "").trim() || undefined;

  const gate = await isFeatureEnabledForNickname(nickname, featureKey);
  if (!gate.ok) {
    return NextResponse.json(
      {
        error: "서버 생성 기능은 유료/관리자 승인 후 사용 가능합니다. 관리자 메뉴 > 기능 승인(유료) 토글에서 승인 후 다시 시도해 주세요.",
        reason: gate.reason,
      },
      { status: 402 }
    );
  }

  const cached = await findCachedServerImage({ nickname, featureKey, prompt, negativePrompt });
  if (cached) {
    return NextResponse.json({
      cached: true,
      url: cached.url,
      storage: cached.storage,
      width: cached.width,
      height: cached.height,
      created_at: cached.created_at,
    });
  }

  const lock = await acquireImageLock(nickname);
  if (!lock.ok) {
    return NextResponse.json(
      { error: lock.error, locked_until: (lock as { locked_until?: string }).locked_until ?? null },
      { status: 409 }
    );
  }

  const limitRes = await checkServerImageUsage({ nickname });
  if (!limitRes.allowed) {
    await releaseImageLock(nickname);
    return NextResponse.json(
      {
        error: limitRes.message,
        usedToday: limitRes.usedToday,
        dailyLimit: limitRes.dailyLimit,
        usedMonth: limitRes.usedMonth,
        monthlyLimit: limitRes.monthlyLimit,
      },
      { status: 429 }
    );
  }

  const cfg = getServerImageConfig();
  const dims = resolveServerDimensions(featureKey, body);
  const useAsync = body.sync !== true && (body.async === true || cfg.asyncDefault);

  if (useAsync) {
    const created = await createServerImageJob({
      nickname,
      featureKey,
      prompt,
      negativePrompt,
      width: dims.width,
      height: dims.height,
      steps: dims.steps,
    });
    if (!created.ok) {
      await releaseImageLock(nickname);
      const hint =
        created.error?.includes("image_generation_jobs") || created.error?.includes("does not exist")
          ? " Supabase에 migrations/025_image_generation_jobs.sql 을 적용해 주세요."
          : "";
      return NextResponse.json({ error: `${created.error}${hint}` }, { status: 500 });
    }
    return NextResponse.json({
      mode: "async",
      provider,
      providerLabel: process.env.NODE_ENV === "development" ? providerDisplayName(provider) : undefined,
      jobId: created.job.id,
      status: created.job.status,
      pollUrl: `/api/ai/image/jobs/${created.job.id}`,
      dimensions: process.env.NODE_ENV === "development" ? { width: dims.width, height: dims.height, steps: dims.steps } : undefined,
      pollIntervalMs: cfg.pollIntervalMs,
      pollMaxMs: cfg.pollMaxMs,
      hint:
        process.env.NODE_ENV === "development"
          ? `생성이 끝날 때까지 잠시 기다려 주세요. (${providerDisplayName(provider)}, ${dims.width}×${dims.height})`
          : "생성이 끝날 때까지 잠시 기다려 주세요.",
      usage: process.env.NODE_ENV === "development"
        ? {
            usedToday: limitRes.usedToday,
            dailyLimit: limitRes.dailyLimit,
            usedMonth: limitRes.usedMonth,
            monthlyLimit: limitRes.monthlyLimit,
          }
        : undefined,
    });
  }

  try {
    const gen = await runServerImageGeneration({
      nickname,
      featureKey,
      prompt,
      negativePrompt,
      provider,
      engineUrl,
      width: dims.width,
      height: dims.height,
      steps: dims.steps,
      recordUsage: true,
    });
    await releaseImageLock(nickname);
    if (!gen.ok) {
      return NextResponse.json(
        {
          error: gen.error,
          timedOut: gen.timedOut ?? false,
          engineStatus: gen.engineStatus ?? null,
          engineError: gen.engineError ?? null,
          dimensions: dims,
        },
        { status: gen.timedOut ? 504 : 502 }
      );
    }
    return NextResponse.json({
      mode: "sync",
      provider,
      providerLabel: providerDisplayName(provider),
      imageBase64: gen.result.imageBase64,
      width: gen.result.width,
      height: gen.result.height,
      steps: gen.result.steps,
      dimensions: dims,
      ...(gen.result.storageWarning ? { storageWarning: gen.result.storageWarning } : {}),
      usage: gen.result.usage,
    });
  } catch (e) {
    await releaseImageLock(nickname);
    return NextResponse.json({ error: "서버 이미지 생성 중 오류", detail: String(e).slice(0, 500) }, { status: 502 });
  }
}
