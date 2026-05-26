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
기록과 사용자 정보를 반영해, 따뜻하고 긍정적인 맞춤 한마디를 한국어로 작성하세요.

필수 조건:
${AI_KOREAN_STYLE_RULES}
- 오늘 기록의 핵심 감정·상황을 한두 가지로 자연스럽게 녹일 것${profileBlock}

기록:
${text}`;
}

export function buildWarmMessageGeminiSystemPreamble(): string {
  return buildAiKoreanGeminiPreamble(
    "당신은 사용자의 자각 기록을 읽고 맞춤 위로 한마디를 쓰는 도우미입니다."
  );
}

export function buildWarmMessageOpenAiSystemPrompt(): string {
  return buildAiKoreanOpenAiSystem(
    "당신은 사용자의 자각 기록을 읽고 따뜻한 긍정 메시지를 짧게 전하는 도우미입니다."
  );
}
