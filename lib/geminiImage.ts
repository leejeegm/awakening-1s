import {
  appendGeminiAvoidBlock,
  GEMINI_IMAGE_SYSTEM_INSTRUCTION,
} from "@/lib/imageStyleGuidance";
import { tryConsumeGeminiRateDb } from "@/lib/geminiRateLimitDb";
import { takeGeminiRateSlot } from "@/lib/geminiRateLimit";
import { getServerImageConfig } from "@/lib/serverImageConfig";
import type { ServerImageGenerateResult } from "@/lib/serverImageTypes";

function aspectRatioFromSize(width: number, height: number): string {
  if (width === height) return "1:1";
  if (width > height) return "16:9";
  return "9:16";
}

function extractImageBase64(json: {
  candidates?: { content?: { parts?: Record<string, unknown>[] } }[];
  error?: { message?: string };
}): string | null {
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = (part.inline_data ?? part.inlineData) as
      | { data?: string; mime_type?: string; mimeType?: string }
      | undefined;
    if (inline?.data) return inline.data;
  }
  return null;
}

/**
 * Gemini 이미지 생성 (Nano Banana / gemini-2.5-flash-image 등)
 * @see https://ai.google.dev/gemini-api/docs/image-generation
 */
export async function callGeminiImage(opts: {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  rateLimitKey?: string;
  timeoutMs?: number;
}): Promise<ServerImageGenerateResult> {
  const apiKey = process.env.GEMINI_JAKKAE_API_KEY ?? process.env.GEMINI_API_KEY ?? "";
  if (!apiKey) {
    return { ok: false, error: "GEMINI_API_KEY가 설정되지 않았습니다." };
  }

  if (opts.rateLimitKey) {
    const db = await tryConsumeGeminiRateDb(opts.rateLimitKey);
    if (db === false) {
      return { ok: false, error: "Gemini 요청이 많아 잠시 후 다시 시도해 주세요." };
    }
    if (db === null && !takeGeminiRateSlot(opts.rateLimitKey)) {
      return { ok: false, error: "Gemini 요청이 많아 잠시 후 다시 시도해 주세요." };
    }
  }

  const model =
    process.env.GEMINI_IMAGE_MODEL?.trim() ||
    "gemini-2.5-flash-image";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const textPrompt = appendGeminiAvoidBlock(opts.prompt, opts.negativePrompt);

  const timeoutMs = opts.timeoutMs ?? getServerImageConfig().engineTimeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: GEMINI_IMAGE_SYSTEM_INSTRUCTION }],
        },
        contents: [{ role: "user", parts: [{ text: textPrompt }] }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: {
            aspectRatio: aspectRatioFromSize(opts.width, opts.height),
          },
        },
      }),
    });

    const errText = !res.ok ? await res.text().catch(() => "") : "";
    if (!res.ok) {
      const msg = errText.slice(0, 600) || "Gemini 이미지 요청 실패";
      if (res.status === 429 || msg.toLowerCase().includes("quota")) {
        return { ok: false, error: "Gemini 무료 한도에 도달했을 수 있습니다. 잠시 후 다시 시도해 주세요.", engineStatus: res.status };
      }
      return { ok: false, error: msg, engineStatus: res.status, engineError: errText.slice(0, 200) };
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: Record<string, unknown>[] } }[];
      error?: { message?: string };
    };
    if (json.error?.message) {
      return { ok: false, error: json.error.message.slice(0, 600) };
    }

    const b64 = extractImageBase64(json);
    if (!b64) {
      return { ok: false, error: "Gemini 이미지 응답이 비어 있습니다. 모델이 이미지 출력을 지원하는지 확인해 주세요." };
    }
    return { ok: true, imageBase64: b64 };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return {
        ok: false,
        timedOut: true,
        error: "Gemini 이미지 생성 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
      };
    }
    return { ok: false, error: "Gemini 이미지 생성 중 오류", engineError: String(e).slice(0, 500) };
  } finally {
    clearTimeout(timer);
  }
}
