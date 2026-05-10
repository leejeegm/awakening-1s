import { geminiGenerateText } from "@/lib/gemini";

type ModerationResult = {
  allowed: boolean;
  severity: "ok" | "warn" | "block";
  reason: string | null;
};

export type ModerateOptions = {
  /** 결정적 찰나(1s)일 때만 경계(warn) 건에 고성능 모델을 추가 호출합니다. */
  durationType?: "1s" | "10s" | "100s";
};

const BLOCK_PATTERNS: RegExp[] = [
  /(?:씨발|ㅅㅂ|병신|ㅂㅅ|좆|존나)/i,
  /(?:대통령|국회|정당|선거|탄핵|좌파|우파|빨갱이|친일)/i,
  /(?:예수|부처|알라|교회|성경|이슬람|불교|기독교|천주교|사탄)/i,
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

function normalizeSeverity(s: unknown): "ok" | "warn" | "block" {
  return s === "warn" || s === "block" || s === "ok" ? s : "ok";
}

/** 모델 출력에서 JSON 한 객체를 추출해 파싱 */
function parseModerationJson(raw: string): ModerationResult | null {
  let s = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```\s*$/im.exec(s);
  if (fenced) s = fenced[1].trim();
  try {
    const parsed = JSON.parse(s) as Record<string, unknown>;
    if (typeof parsed.allowed !== "boolean") return null;
    return {
      allowed: parsed.allowed,
      severity: normalizeSeverity(parsed.severity),
      reason: typeof parsed.reason === "string" ? parsed.reason : null,
    };
  } catch {
    const m = s.match(/\{[\s\S]*"allowed"[\s\S]*\}/);
    if (!m) return null;
    try {
      const parsed = JSON.parse(m[0]) as Record<string, unknown>;
      if (typeof parsed.allowed !== "boolean") return null;
      return {
        allowed: parsed.allowed,
        severity: normalizeSeverity(parsed.severity),
        reason: typeof parsed.reason === "string" ? parsed.reason : null,
      };
    } catch {
      return null;
    }
  }
}

async function geminiClassify(note: string): Promise<ModerationResult | null> {
  const prompt =
    "너는 공개 게시용 짧은 텍스트를 안전 정책 관점에서 분류한다.\n" +
    "다음 형식의 JSON **한 줄(또는 단일 객체)만** 출력한다. 코드펜스·설명 금지.\n" +
    '형식: {"allowed":true|false,"severity":"ok"|"warn"|"block","reason":"..."|null}\n' +
    "block: 정치/종교 선동, 혐오/욕설, 폭력·자해·협박, 개인정보(연락처 등) 과다 노출.\n" +
    "warn: 애매하지만 즉시 차단까지는 어렵다고 판단될 때.\n" +
    "ok: 통과.\n\n" +
    "텍스트:\n" +
    note.slice(0, 300);

  const g = await geminiGenerateText({ prompt, maxOutputTokens: 180 });
  if (!g.ok) return null;
  return parseModerationJson(g.text);
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
    const parsed = parseModerationJson(content);
    return parsed;
  } catch {
    return null;
  }
}

export async function moderateForPublicShare(note: string, opts?: ModerateOptions): Promise<ModerationResult> {
  const rb = ruleBased(note);
  if (!rb.allowed) return rb;

  const openaiKey = process.env.OPENAI_API_KEY ?? "";
  const geminiFirst = await geminiClassify(note);

  const isDecisionalMoment = opts?.durationType === "1s";

  if (!geminiFirst) {
    if (openaiKey) {
      const o = await openAiClassify(note, openaiKey);
      if (o) return o;
    }
    return rb;
  }

  if (geminiFirst.severity === "block") {
    return { allowed: false, severity: "block", reason: geminiFirst.reason ?? "policy_sensitive" };
  }
  /** allowed=false 이고 warn이 아니면 공개 차단과 동일하게 block으로 올림 */
  if (!geminiFirst.allowed && geminiFirst.severity !== "warn") {
    return { allowed: false, severity: "block", reason: geminiFirst.reason ?? "policy_sensitive" };
  }

  if (geminiFirst.severity === "warn") {
    if (isDecisionalMoment && openaiKey) {
      const o = await openAiClassify(note, openaiKey);
      if (o) return o;
    }
    return geminiFirst;
  }

  return geminiFirst;
}
