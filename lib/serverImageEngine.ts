import { callGeminiImage } from "@/lib/geminiImage";
import { callPollinationsImage } from "@/lib/pollinationsImage";
import { getServerImageConfig } from "@/lib/serverImageConfig";
import type { ImageProvider } from "@/lib/serverImageProvider";
import type { ServerImageGenerateResult } from "@/lib/serverImageTypes";

export type Txt2ImgResult = ServerImageGenerateResult;

export async function callTxt2Img(opts: {
  engineUrl: string;
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  steps: number;
  timeoutMs?: number;
}): Promise<Txt2ImgResult> {
  const timeoutMs = opts.timeoutMs ?? getServerImageConfig().engineTimeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(opts.engineUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        prompt: opts.prompt,
        negative_prompt: opts.negativePrompt || undefined,
        width: opts.width,
        height: opts.height,
        steps: opts.steps,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      images?: string[];
      error?: unknown;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: "이미지 엔진 요청 실패",
        engineStatus: res.status,
        engineError: json?.error ?? null,
      };
    }
    const b64 = Array.isArray(json.images) ? json.images[0] : null;
    if (!b64) return { ok: false, error: "이미지 생성 결과가 없습니다." };
    return { ok: true, imageBase64: b64 };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return {
        ok: false,
        timedOut: true,
        error:
          "이미지 엔진 응답 시간이 초과되었습니다. Vercel Hobby(약 10초) 한도에 맞추려면 steps·해상도를 낮추거나, 클라우드 GPU를 빠르게 설정해 주세요.",
      };
    }
    return { ok: false, error: "서버 이미지 생성 중 오류", engineError: String(e).slice(0, 500) };
  } finally {
    clearTimeout(timer);
  }
}

export async function callServerImageProvider(opts: {
  provider: ImageProvider;
  engineUrl?: string;
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  steps: number;
  rateLimitKey?: string;
  timeoutMs?: number;
}): Promise<Txt2ImgResult> {
  const common = {
    prompt: opts.prompt,
    negativePrompt: opts.negativePrompt,
    width: opts.width,
    height: opts.height,
    timeoutMs: opts.timeoutMs,
  };

  if (opts.provider === "gemini") {
    return callGeminiImage({ ...common, rateLimitKey: opts.rateLimitKey });
  }
  if (opts.provider === "pollinations") {
    return callPollinationsImage(common);
  }
  const engineUrl = (opts.engineUrl ?? "").trim();
  if (!engineUrl) {
    return { ok: false, error: "IMAGE_ENGINE_URL이 설정되지 않았습니다." };
  }
  return callTxt2Img({
    engineUrl,
    ...common,
    steps: opts.steps,
  });
}
