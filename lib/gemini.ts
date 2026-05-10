export type GeminiGenerateArgs = {
  prompt: string;
  /** 짧은 출력이 목적이라 기본 256 */
  maxOutputTokens?: number;
};

type GeminiOk = { ok: true; text: string; model: string };
type GeminiErr = { ok: false; error: string; status?: number };

/**
 * Google Gemini 텍스트 생성 (1차 필터/요약/분류용)
 * - 서버에서만 호출 (API 키 노출 금지)
 */
export async function geminiGenerateText(args: GeminiGenerateArgs): Promise<GeminiOk | GeminiErr> {
  const apiKey = process.env.GEMINI_JAKKAE_API_KEY ?? process.env.GEMINI_API_KEY ?? "";
  if (!apiKey) return { ok: false, error: "GEMINI_API_KEY가 설정되지 않았습니다." };

  const model = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: args.prompt }] }],
        generationConfig: {
          maxOutputTokens: Math.max(32, Math.min(1024, Math.floor(args.maxOutputTokens ?? 256))),
          temperature: 0.7,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: errText.slice(0, 800) || "Gemini 요청 실패" };
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("")?.trim() ?? "";
    if (!text) return { ok: false, status: 502, error: "Gemini 응답이 비어 있습니다." };
    return { ok: true, text, model };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 800) || "Gemini 예외" };
  }
}

