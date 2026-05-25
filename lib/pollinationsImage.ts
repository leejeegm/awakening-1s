import { getServerImageConfig } from "@/lib/serverImageConfig";
import type { ServerImageGenerateResult } from "@/lib/serverImageTypes";

const DEFAULT_BASE = "https://image.pollinations.ai/prompt";

/**
 * Pollinations — 키 없이 MVP 데모용 (정책·가용성 변동 가능)
 */
export async function callPollinationsImage(opts: {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  timeoutMs?: number;
}): Promise<ServerImageGenerateResult> {
  const base = (process.env.POLLINATIONS_IMAGE_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, "");
  const fullPrompt = [
    opts.prompt,
    opts.negativePrompt?.trim() ? ` Avoid: ${opts.negativePrompt.trim()}` : "",
  ].join("");

  const params = new URLSearchParams({
    width: String(Math.min(1024, Math.max(256, opts.width))),
    height: String(Math.min(1024, Math.max(256, opts.height))),
    nologo: "true",
    private: "true",
  });

  const url = `${base}/${encodeURIComponent(fullPrompt)}?${params.toString()}`;
  const timeoutMs = opts.timeoutMs ?? getServerImageConfig().engineTimeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) {
      return {
        ok: false,
        error: "Pollinations 이미지 요청 실패",
        engineStatus: res.status,
      };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) {
      return { ok: false, error: "Pollinations 응답이 비어 있습니다." };
    }
    return { ok: true, imageBase64: buf.toString("base64") };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return {
        ok: false,
        timedOut: true,
        error: "Pollinations 응답 시간이 초과되었습니다.",
      };
    }
    return { ok: false, error: "Pollinations 이미지 생성 중 오류", engineError: String(e).slice(0, 500) };
  } finally {
    clearTimeout(timer);
  }
}
