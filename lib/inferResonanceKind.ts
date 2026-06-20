import { geminiGenerateText } from "@/lib/gemini";
import {
  isResonanceKindId,
  RESONANCE_ESSENCES,
  type ResonanceKindId,
} from "@/lib/resonanceEssence";
import {
  keywordMatchWeight,
  RESONANCE_KIND_KEYWORDS,
  RULE_CONFIDENT_WEIGHT,
  RULE_FALLBACK_WEIGHT,
} from "@/lib/resonanceKindKeywords";

function scoreByKeywords(note: string): { id: ResonanceKindId; weight: number } | null {
  const text = note.toLowerCase();
  let best: { id: ResonanceKindId; weight: number } | null = null;
  for (const id of Object.keys(RESONANCE_KIND_KEYWORDS) as ResonanceKindId[]) {
    let weight = 0;
    for (const kw of RESONANCE_KIND_KEYWORDS[id]) {
      if (!text.includes(kw.toLowerCase())) continue;
      weight += keywordMatchWeight(kw);
      if (weight >= RULE_CONFIDENT_WEIGHT) return { id, weight };
    }
    if (!best || weight > best.weight) best = { id, weight };
  }
  if (!best || best.weight < 1) return null;
  return best;
}

function parseKindFromModelText(raw: string): ResonanceKindId | null {
  const t = raw.trim().toLowerCase();
  const direct = t.match(/\b(self|interpersonal|belonging|social|nature|life|other)\b/);
  if (direct && isResonanceKindId(direct[1])) return direct[1];
  const ko = RESONANCE_ESSENCES.find(
    (e) => t.includes(e.title.replace(/과의 감응|적 감응| 감응/g, "")) || t.includes(e.id)
  );
  return ko?.id ?? null;
}

async function inferWithGemini(
  note: string,
  durationType: string,
  rateLimitKey?: string
): Promise<ResonanceKindId | null> {
  const essenceLines = RESONANCE_ESSENCES.map((e) => `- ${e.id}: ${e.title} — ${e.essence}`).join("\n");
  const prompt = `당신은 한국어 자각 기록의 감응(Resonans) 유형 분류기입니다.
사용자는 유형을 고르지 않았습니다. 기록의 키워드·맥락·정서에 가장 가까운 유형 id 하나만 고르세요.

유형 (id만 사용, none 금지):
${essenceLines}

기록 길이: ${durationType}
기록 내용:
"""
${note}
"""

반드시 id 하나만 출력 (설명 없음). 예: nature`;

  const res = await geminiGenerateText({
    prompt,
    maxOutputTokens: 32,
    rateLimitKey: rateLimitKey ? `resonance-infer:${rateLimitKey}` : undefined,
  });
  if (!res.ok) return null;
  return parseKindFromModelText(res.text);
}

/**
 * 미선택 기록에 대한 AI·룰베이스 감응 유형 추천.
 * 사용자 선택(none)은 바꾸지 않고, 별도 필드(resonance_kind_ai)용.
 */
export async function inferResonanceKindFromNote(
  note: string,
  durationType: string,
  options?: { rateLimitKey?: string }
): Promise<ResonanceKindId | null> {
  const trimmed = note.trim();
  if (!trimmed) return null;

  const ruled = scoreByKeywords(trimmed);
  if (ruled && ruled.weight >= RULE_CONFIDENT_WEIGHT) return ruled.id;

  const fromAi = await inferWithGemini(trimmed, durationType, options?.rateLimitKey);
  if (fromAi) return fromAi;

  if (ruled && ruled.weight >= RULE_FALLBACK_WEIGHT) return ruled.id;
  return null;
}
