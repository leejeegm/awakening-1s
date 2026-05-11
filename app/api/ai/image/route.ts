import { NextRequest, NextResponse } from "next/server";
import { isFeatureEnabledForNickname, type FeatureKey, normalizeNickname } from "@/lib/entitlements";
import { checkAndRecordServerImageUsage } from "@/lib/imageLimits";
import { acquireImageLock, releaseImageLock } from "@/lib/imageLock";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createSignedImageUrl, sha256Hex, uploadPngBase64 } from "@/lib/imageStorage";
import { verifyParticipantAuthHash } from "@/lib/participantAuth";
import type { Database } from "@/types/supabase";

type CachedAssetRow = Pick<
  Database["public"]["Tables"]["image_generation_assets"]["Row"],
  "storage_bucket" | "storage_path" | "width" | "height" | "created_at"
>;

type Body = {
  nickname?: string;
  /** 비밀번호 SHA-256 hex — 타인 닉네임으로 서버 생성·쿼터 남용 방지 */
  authHash?: string;
  featureKey?: FeatureKey;
  prompt?: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
};

function clampInt(v: unknown, min: number, max: number, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/**
 * 서버 이미지 생성 (유료/승인)
 * - entitlement가 true인 사용자만 허용
 * - 엔진은 오픈소스 SD(WebUI/Comfy 등)로 별도 운영하고, 여기서는 HTTP로 호출
 *
 * 설정:
 * - IMAGE_ENGINE_URL: 예) http://127.0.0.1:7860/sdapi/v1/txt2img (서버에서 접근 가능한 주소)
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

  const gate = await isFeatureEnabledForNickname(nickname, featureKey);
  if (!gate.ok) {
    return NextResponse.json(
      {
        error: "서버 생성 기능은 유료/관리자 승인 후 사용 가능합니다.",
        reason: gate.reason,
      },
      { status: 402 }
    );
  }

  // 캐시: 동일 프롬프트(해시)가 최근 24시간 내에 있으면 엔진 호출 없이 반환
  const admin = getSupabaseAdmin();
  const promptHash = sha256Hex(`${featureKey}::${prompt}::${negativePrompt}`);
  if (admin) {
    try {
      const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: cached } = await admin
        .from("image_generation_assets")
        .select("storage_bucket, storage_path, width, height, created_at")
        .eq("nickname", nickname)
        .eq("feature_key", featureKey)
        .eq("prompt_hash", promptHash)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const hit = cached as CachedAssetRow | null;
      if (hit?.storage_bucket && hit.storage_path) {
        const signedUrl = await createSignedImageUrl(hit.storage_bucket, hit.storage_path, 60 * 10);
        return NextResponse.json({
          cached: true,
          url: signedUrl,
          storage: { bucket: hit.storage_bucket, path: hit.storage_path },
          width: hit.width,
          height: hit.height,
          created_at: hit.created_at,
        });
      }
    } catch {
      // ignore cache errors
    }
  }

  const lock = await acquireImageLock(nickname);
  if (!lock.ok) {
    return NextResponse.json(
      { error: lock.error, locked_until: (lock as { locked_until?: string }).locked_until ?? null },
      { status: 409 }
    );
  }

  const limitRes = await checkAndRecordServerImageUsage({
    nickname,
    featureKey,
  });
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

  const engineUrl = process.env.IMAGE_ENGINE_URL ?? "";
  if (!engineUrl) {
    return NextResponse.json(
      { error: "서버 이미지 엔진이 설정되지 않았습니다. IMAGE_ENGINE_URL을 확인하세요." },
      { status: 503 }
    );
  }

  const width = clampInt(body.width, 256, 1024, featureKey === "comic_4panel" ? 1024 : 768);
  const height = clampInt(body.height, 256, 1024, featureKey === "comic_4panel" ? 1024 : 512);
  const steps = clampInt(body.steps, 10, 40, 20);

  // 4컷은 "2x2 그리드" 한 장으로 생성하도록 유도 (후처리는 클라이언트에서 분할 가능)
  const finalPrompt =
    featureKey === "comic_4panel"
      ? `${prompt}\n\n4 panel comic, 2x2 grid layout, consistent character, clean line art, korean webtoon style`
      : prompt;

  try {
    const res = await fetch(engineUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: finalPrompt,
        negative_prompt: negativePrompt || undefined,
        width,
        height,
        steps,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as { images?: string[]; info?: unknown; error?: unknown };
    if (!res.ok) {
      await releaseImageLock(nickname);
      return NextResponse.json(
        { error: "이미지 엔진 요청 실패", engineStatus: res.status, engineError: json?.error ?? null },
        { status: 502 }
      );
    }
    const b64 = Array.isArray(json.images) ? json.images[0] : null;
    if (!b64) {
      await releaseImageLock(nickname);
      return NextResponse.json({ error: "이미지 생성 결과가 없습니다." }, { status: 502 });
    }

    // 스토리지 업로드 + 메타 저장 (실패해도 base64는 반환 — 사용자는 화면에서 저장 가능)
    let storageWarning: string | undefined;
    if (admin) {
      const up = await uploadPngBase64({ nickname, base64: b64, featureKey });
      if (up.ok) {
        const ins = await admin.from("image_generation_assets").insert({
          nickname,
          feature_key: featureKey,
          mode: "server",
          prompt,
          negative_prompt: negativePrompt || null,
          prompt_hash: promptHash,
          width,
          height,
          steps,
          storage_bucket: up.bucket,
          storage_path: up.path,
          engine: "sd_webui",
          engine_meta: { engineUrl: engineUrl.slice(0, 200), cached: false },
        } as never);
        if (ins.error) {
          console.warn("[image-storage] meta insert failed", ins.error.message);
          storageWarning =
            "이미지는 준비되었어요. 기록 보관에 잠시 반영이 늦을 수 있어요. 아래에서 다운로드로 저장해 두시면 안전해요.";
        }
      } else {
        console.warn("[image-storage] upload failed", up.error);
        storageWarning =
          "이미지는 만들어졌어요. 온라인 보관은 설정 점검이 필요할 수 있어요. 다운로드로 저장해 두시면 됩니다.";
      }
    }

    await releaseImageLock(nickname);
    return NextResponse.json({
      imageBase64: b64,
      width,
      height,
      ...(storageWarning ? { storageWarning } : {}),
      usage: {
        usedToday: limitRes.usedToday,
        dailyLimit: limitRes.dailyLimit,
        usedMonth: limitRes.usedMonth,
        monthlyLimit: limitRes.monthlyLimit,
      },
    });
  } catch (e) {
    await releaseImageLock(nickname);
    return NextResponse.json({ error: "서버 이미지 생성 중 오류", detail: String(e).slice(0, 500) }, { status: 502 });
  }
}

