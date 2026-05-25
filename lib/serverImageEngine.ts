import { getServerImageConfig } from "@/lib/serverImageConfig";

export type Txt2ImgResult =
  | { ok: true; imageBase64: string }
  | { ok: false; error: string; timedOut?: boolean; engineStatus?: number; engineError?: unknown };

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
