import { takeGeminiRateSlot } from "@/lib/geminiRateLimit";
import { tryConsumeGeminiRateDb } from "@/lib/geminiRateLimitDb";

/** 2.5 Flash thinking 토큰이 maxOutputTokens를 잠식하지 않도록 본문용 기본 상한 */
const GEMINI_TEXT_DEFAULT_MAX_OUTPUT = 512;
const GEMINI_TEXT_MAX_OUTPUT_CAP = 8192;

export type GeminiGenerateArgs = {
  prompt: string;
  /** 본문 생성 기본 512 (2.5 Flash thinking 예산 분리) */
  maxOutputTokens?: number;
  /** 닉네임·IP 등 — 서버 인스턴스별 호출 상한(베스트 에포트) */
  rateLimitKey?: string;
};

export type GeminiFailureKind =
  | "missing_key"
  | "quota"
  | "empty_response"
  | "http_error"
  | "network"
  | "local_rate_limit";

export type GeminiOk = { ok: true; text: string; model: string };
export type GeminiErr = { ok: false; error: string; status?: number; failureKind: GeminiFailureKind };

export type GeminiResult = GeminiOk | GeminiErr;

function resolveGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

/** 2.5 Flash: thinkingBudget 0 — thinking이 출력 한도를 잠식하는 문제 방지 */
function buildGeminiThinkingConfig(model: string): { thinkingBudget: number } | undefined {
  const m = model.toLowerCase();
  if (/gemini-2\.5-pro/.test(m)) return { thinkingBudget: 128 };
  if (/gemini-2\.5.*flash/.test(m)) return { thinkingBudget: 0 };
  return undefined;
}

function classifyGeminiHttpError(status: number, body: string): GeminiFailureKind {
  const b = body.toLowerCase();
  if (status === 429) return "quota";
  if (b.includes("resource_exhausted") || b.includes("quota") || b.includes("rate limit") || b.includes("too many requests")) {
    return "quota";
  }
  return "http_error";
}

/**
 * Google Gemini 텍스트 생성 (1차 필터/요약/분류용)
 * - 서버에서만 호출 (API 키 노출 금지)
 */
export async function geminiGenerateText(args: GeminiGenerateArgs): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_JAKKAE_API_KEY ?? process.env.GEMINI_API_KEY ?? "";
  if (!apiKey) {
    return { ok: false, error: "GEMINI_API_KEY가 설정되지 않았습니다.", failureKind: "missing_key" };
  }

  if (args.rateLimitKey) {
    const db = await tryConsumeGeminiRateDb(args.rateLimitKey);
    if (db === false) {
      return {
        ok: false,
        error: "요청이 많아 잠시 후 다시 시도해 주세요.",
        failureKind: "local_rate_limit",
      };
    }
    if (db === null && !takeGeminiRateSlot(args.rateLimitKey)) {
      return {
        ok: false,
        error: "요청이 많아 잠시 후 다시 시도해 주세요.",
        failureKind: "local_rate_limit",
      };
    }
  }

  const model = resolveGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const thinkingConfig = buildGeminiThinkingConfig(model);
  const maxOutputTokens = Math.max(
    32,
    Math.min(
      GEMINI_TEXT_MAX_OUTPUT_CAP,
      Math.floor(args.maxOutputTokens ?? GEMINI_TEXT_DEFAULT_MAX_OUTPUT)
    )
  );
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens,
    temperature: 0.7,
  };
  if (thinkingConfig) generationConfig.thinkingConfig = thinkingConfig;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: args.prompt }] }],
        generationConfig,
      }),
    });

    const errText = !res.ok ? await res.text().catch(() => "") : "";
    if (!res.ok) {
      const failureKind = classifyGeminiHttpError(res.status, errText);
      return {
        ok: false,
        status: res.status,
        error: errText.slice(0, 800) || "Gemini 요청 실패",
        failureKind,
      };
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      error?: { message?: string; status?: string };
    };
    if (json.error?.message) {
      const msg = json.error.message;
      const failureKind = classifyGeminiHttpError(502, msg);
      return { ok: false, status: 502, error: msg.slice(0, 800), failureKind };
    }
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("")?.trim() ?? "";
    if (!text) {
      return { ok: false, status: 502, error: "Gemini 응답이 비어 있습니다.", failureKind: "empty_response" };
    }
    return { ok: true, text, model };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 800) || "Gemini 예외", failureKind: "network" };
  }
}
