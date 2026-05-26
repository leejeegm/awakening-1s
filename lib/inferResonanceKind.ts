import { geminiGenerateText } from "@/lib/gemini";
import {
  isResonanceKindId,
  RESONANCE_ESSENCES,
  type ResonanceKindId,
} from "@/lib/resonanceEssence";

/** 유형별 키워드 힌트(룰베이스 1차 분류) */
const KIND_KEYWORDS: Record<ResonanceKindId, string[]> = {
  self: [
    "나",
    "내",
    "스스로",
    "마음",
    "감정",
    "불안",
    "기쁨",
    "슬픔",
    "우울",
    "자신",
    "느꼈",
    "힘들",
    "외로",
  ],
  interpersonal: [
    "친구",
    "연인",
    "가족",
    "대화",
    "상대",
    "관계",
    "엄마",
    "아빠",
    "형",
    "누나",
    "동생",
    "썸",
    "이별",
    "그리움",
  ],
  belonging: ["팀", "회사", "학교", "동아리", "우리", "소속", "부서", "조직", "멤버", "동료"],
  social: ["사회", "뉴스", "시대", "정치", "경제", "문화", "세상", "이슈", "직장", "역할"],
  nature: [
    "바다",
    "산",
    "하늘",
    "바람",
    "비",
    "눈",
    "계절",
    "자연",
    "숲",
    "해변",
    "날씨",
    "햇",
    "달",
    "구름",
  ],
  life: ["강아지", "고양이", "반려", "식물", "꽃", "새", "동물", "생명", "새끼", "씨앗"],
  other: ["음악", "노래", "예술", "그림", "꿈", "침묵", "시간", "우연", "신", "기도"],
};

function scoreByKeywords(note: string): { id: ResonanceKindId; score: number } | null {
  const text = note.toLowerCase();
  let best: { id: ResonanceKindId; score: number } | null = null;
  for (const id of Object.keys(KIND_KEYWORDS) as ResonanceKindId[]) {
    let score = 0;
    for (const kw of KIND_KEYWORDS[id]) {
      if (text.includes(kw)) score += 1;
    }
    if (!best || score > best.score) best = { id, score };
  }
  if (!best || best.score < 1) return null;
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
  if (ruled && ruled.score >= 2) return ruled.id;

  const fromAi = await inferWithGemini(trimmed, durationType, options?.rateLimitKey);
  if (fromAi) return fromAi;

  if (ruled && ruled.score >= 1) return ruled.id;
  return null;
}
