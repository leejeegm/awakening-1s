import {
  AI_KOREAN_STYLE_RULES,
  aiKoreanCharCount,
  buildAiKoreanGeminiPreamble,
  buildAiKoreanOpenAiSystem,
  finalizeAiKoreanMessage,
} from "@/lib/aiKoreanMessageFormat";

export type InsightCardProfile = {
  genderLabel?: string | null;
  ageLabel?: string | null;
};

export const insightCardCharCount = aiKoreanCharCount;
export const finalizeInsightCard = finalizeAiKoreanMessage;

/** 맞춤 감응 카드 전용 — 따뜻한 한마디와 구분 */
export const INSIGHT_CARD_WRITING_POINTS_PERSONAL = `- 역할: 쌓인 자각 기록을 비추는 「맞춤 감응 카드」 한 문단.
- 초점: 반복되는 단서·마음의 방향·작은 변화·스스로에 대한 이해가 깊어지는 통찰.
- 쓸 것: 기록 속 흐름을 거울처럼 비추는 말, 가벼운 희망·다음 걸음에 대한 부드러운 시선.
- 쓰지 말 것: 오늘만 위로하는 한마디, 숨 고르기·지금 괜찮아요류(따뜻한 한마디 영역).`;

export const INSIGHT_CARD_WRITING_POINTS_TREND = `- 역할: 여러 참여자 기록에서 읽는 「이번 감응 트렌드」 카드.
- 초점: 공통으로 스며드는 분위기·방향, 함께 나누는 희망.
- 쓰지 말 것: 개인에게 직접 위로하는 한마디 톤.`;

export function buildInsightCardPrompt(args: {
  notesSample: string;
  recordCount: number;
  scope: "personal" | "trend";
  profile?: InsightCardProfile;
}): string {
  const profileLines: string[] = [];
  if (args.profile?.genderLabel) profileLines.push(`성별(참고): ${args.profile.genderLabel}`);
  if (args.profile?.ageLabel) profileLines.push(`연령대(참고): ${args.profile.ageLabel}`);
  const profileBlock =
    profileLines.length > 0
      ? `\n사용자 정보(맞춤 공감용, 직접 언급하지 말 것):\n${profileLines.join("\n")}`
      : "";

  if (args.scope === "personal") {
    return `다음은 한 사용자의 자각 기록 ${args.recordCount}건 중 일부입니다.
「맞춤 감응 카드」만 작성하세요. 따뜻한 한마디(오늘 위로)와 겹치지 않게.

작성 포인트:
${INSIGHT_CARD_WRITING_POINTS_PERSONAL}

필수 조건:
${AI_KOREAN_STYLE_RULES}
- 누적 기록에서 드러난 흐름·패턴·통찰을 한두 가지로 담을 것${profileBlock}

기록:
${args.notesSample}`;
  }

  return `다음은 여러 참여자의 자각 기록 일부입니다.
「이번 감응 트렌드」 카드만 작성하세요.

작성 포인트:
${INSIGHT_CARD_WRITING_POINTS_TREND}

필수 조건:
${AI_KOREAN_STYLE_RULES}

기록:
${args.notesSample}`;
}

export function buildInsightCardGeminiSystemPreamble(scope: "personal" | "trend"): string {
  if (scope === "personal") {
    return buildAiKoreanGeminiPreamble(
      "당신은 쌓인 자각 기록에서 흐름과 통찰을 담은 맞춤 감응 카드만 쓰는 도우미입니다. 오늘의 위로 한마디는 쓰지 마세요."
    );
  }
  return buildAiKoreanGeminiPreamble(
    "당신은 참여자들의 기록에서 이번 감응 트렌드를 짧게 쓰는 도우미입니다."
  );
}

export function buildInsightCardOpenAiSystem(scope: "personal" | "trend"): string {
  if (scope === "personal") {
    return buildAiKoreanOpenAiSystem(
      "당신은 맞춤 감응 카드(흐름·통찰)만 다듬는 도우미입니다. 따뜻한 한마디 톤은 쓰지 마세요."
    );
  }
  return buildAiKoreanOpenAiSystem("당신은 감응 트렌드 카드만 다듬는 도우미입니다.");
}
