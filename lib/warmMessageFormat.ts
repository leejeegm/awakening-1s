import {
  AI_KOREAN_MAX_LEN,
  AI_KOREAN_SOFT_MIN_LEN,
  AI_KOREAN_STYLE_RULES,
  aiKoreanCharCount,
  buildAiKoreanGeminiPreamble,
  buildAiKoreanOpenAiSystem,
  finalizeAiKoreanMessage,
} from "@/lib/aiKoreanMessageFormat";

export const WARM_MESSAGE_MIN_LEN = AI_KOREAN_SOFT_MIN_LEN;
export const WARM_MESSAGE_MAX_LEN = AI_KOREAN_MAX_LEN;

export type WarmMessageProfile = {
  genderLabel?: string | null;
  ageLabel?: string | null;
};

const DURATION_LABELS: Record<"1s" | "10s" | "100s", string> = {
  "1s": "1초 찰나",
  "10s": "10초 찰나",
  "100s": "100초 찰나",
};

export const warmMessageCharCount = aiKoreanCharCount;
export const finalizeWarmMessage = finalizeAiKoreanMessage;

/** 따뜻한 한마디 전용 — 맞춤 감응 카드와 구분 */
export const WARM_MESSAGE_WRITING_POINTS = `- 역할: 오늘 방금 남긴 찰나에 대한 「지금 이 순간」의 위로 한마디.
- 초점: 오늘의 감정·숨·다정한 인정. "이해받고 있다"는 느낌.
- 쓸 것: 공감, 가벼운 위로, 오늘을 안아 주는 말.
- 쓰지 말 것: 누적 기록 분석, 패턴·트렌드·흐름 요약, 성장 조언, 다음 계획 제시(감응 카드 영역).`;

export function buildWarmMessagePrompt(args: {
  notes: string[];
  durationType: "1s" | "10s" | "100s";
  profile?: WarmMessageProfile;
}): string {
  const durationLabel = DURATION_LABELS[args.durationType];
  const text = args.notes.join("\n");
  const profileLines: string[] = [];
  if (args.profile?.genderLabel) profileLines.push(`성별(참고): ${args.profile.genderLabel}`);
  if (args.profile?.ageLabel) profileLines.push(`연령대(참고): ${args.profile.ageLabel}`);
  const profileBlock =
    profileLines.length > 0
      ? `\n사용자 정보(맞춤 공감용, 직접 언급하지 말 것):\n${profileLines.join("\n")}`
      : "";

  return `다음은 오늘 사용자가 작성한 ${args.notes.length}개의 「${durationLabel}」 기록입니다.
「따뜻한 한마디」만 작성하세요. 맞춤 감응 카드(흐름·통찰) 문구와 겹치지 않게.

작성 포인트:
${WARM_MESSAGE_WRITING_POINTS}

필수 조건:
${AI_KOREAN_STYLE_RULES}
- 오늘 기록의 지금 느껴지는 감정·상황만 담을 것${profileBlock}

기록:
${text}`;
}

export function buildWarmMessageGeminiSystemPreamble(): string {
  return buildAiKoreanGeminiPreamble(
    "당신은 오늘의 찰나 기록을 읽고, 지금 이 순간 위로가 되는 따뜻한 한마디만 쓰는 도우미입니다. 패턴 분석이나 통찰 카드 문구는 쓰지 마세요."
  );
}

export function buildWarmMessageOpenAiSystemPrompt(): string {
  return buildAiKoreanOpenAiSystem(
    "당신은 오늘의 찰나에 대한 따뜻한 한마디만 다듬는 도우미입니다. 흐름·패턴·통찰은 쓰지 마세요."
  );
}
