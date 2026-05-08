type ModerationResult = {
  allowed: boolean;
  severity: "ok" | "warn" | "block";
  reason: string | null;
};

const BLOCK_PATTERNS: RegExp[] = [
  // 욕설/혐오 (최소한의 예시 - 필요시 확장)
  /(?:씨발|ㅅㅂ|병신|ㅂㅅ|좆|존나)/i,
  // 정치/선동
  /(?:대통령|국회|정당|선거|탄핵|좌파|우파|빨갱이|친일)/i,
  // 종교/비하
  /(?:예수|부처|알라|교회|성경|이슬람|불교|기독교|천주교|사탄)/i,
  // 폭력/위협
  /(?:죽여|살인|자살|폭발|테러|협박)/i,
];

function ruleBased(text: string): ModerationResult {
  const t = (text ?? "").trim();
  if (!t) return { allowed: true, severity: "ok", reason: null };
  const hit = BLOCK_PATTERNS.find((r) => r.test(t));
  if (hit) {
    return { allowed: false, severity: "block", reason: "policy_sensitive" };
  }
  return { allowed: true, severity: "ok", reason: null };
}

async function openAiClassify(text: string, apiKey: string): Promise<ModerationResult | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0,
        max_tokens: 80,
        messages: [
          {
            role: "system",
            content:
              "너는 사용자 텍스트를 안전 정책 관점에서 분류한다. 출력은 반드시 JSON 한 줄로만. 형식: {\"allowed\":true|false,\"severity\":\"ok\"|\"warn\"|\"block\",\"reason\":\"...\"|null}. 정치/종교 선동, 혐오/욕설, 폭력/자해/협박, 개인정보 노출은 block.",
          },
          { role: "user", content: text.slice(0, 300) },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content) as ModerationResult;
    if (!parsed || typeof parsed.allowed !== "boolean") return null;
    return {
      allowed: !!parsed.allowed,
      severity: parsed.severity ?? "ok",
      reason: parsed.reason ?? null,
    };
  } catch {
    return null;
  }
}

export async function moderateForPublicShare(note: string): Promise<ModerationResult> {
  const rb = ruleBased(note);

  // OpenAI 키가 있으면 추가 점검(실패해도 룰베이스로 진행)
  const key = process.env.OPENAI_API_KEY ?? "";
  if (key) {
    const ai = await openAiClassify(note, key);
    if (ai) return ai;
  }
  return rb;
}

