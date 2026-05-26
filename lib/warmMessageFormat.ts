import { sanitizeAiUserText } from "@/lib/aiUserText";

/** 따뜻한 한마디 목표 글자 수(한글 기준, 코드 유닛) */
export const WARM_MESSAGE_MIN_LEN = 50;
export const WARM_MESSAGE_MAX_LEN = 100;

export type WarmMessageProfile = {
  genderLabel?: string | null;
  ageLabel?: string | null;
};

const DURATION_LABELS: Record<"1s" | "10s" | "100s", string> = {
  "1s": "1초 찰나",
  "10s": "10초 찰나",
  "100s": "100초 찰나",
};

export function warmMessageCharCount(text: string): number {
  return Array.from(sanitizeAiUserText(text)).length;
}

function truncateWarmMessage(text: string, max: number): string {
  const chars = Array.from(sanitizeAiUserText(text));
  if (chars.length <= max) return chars.join("");
  const slice = chars.slice(0, max).join("");
  const punct = ["。", ".", "!", "?", "요", "요.", "요!", "요?", "다", "다.", "다!", "다?"];
  for (const p of punct) {
    const idx = slice.lastIndexOf(p);
    if (idx >= Math.floor(max * 0.55)) return slice.slice(0, idx + p.length).trim();
  }
  return slice.trim();
}

function padWarmMessageToMin(text: string, min: number, max: number): string {
  const suffixes = [
    " 오늘도 충분히 잘하고 있어요.",
    " 마음은 응원받아도 좋아요.",
    " 천천히 숨 한 번 더 깊게 쉬어 보세요.",
  ];
  let t = sanitizeAiUserText(text);
  for (const s of suffixes) {
    if (warmMessageCharCount(t) >= min) break;
    if (warmMessageCharCount(t) + warmMessageCharCount(s) <= max) t = `${t}${s}`;
  }
  return truncateWarmMessage(t, max);
}

/** AI·룰 결과를 50~100자로 맞춤 */
export function finalizeWarmMessage(primary: string, ...fallbacks: string[]): string {
  const candidates = [primary, ...fallbacks].map((s) => sanitizeAiUserText(s)).filter(Boolean);

  for (const raw of candidates) {
    const len = warmMessageCharCount(raw);
    if (len >= WARM_MESSAGE_MIN_LEN && len <= WARM_MESSAGE_MAX_LEN) return raw;
    if (len > WARM_MESSAGE_MAX_LEN) {
      const cut = truncateWarmMessage(raw, WARM_MESSAGE_MAX_LEN);
      if (warmMessageCharCount(cut) >= WARM_MESSAGE_MIN_LEN) return cut;
    }
    if (len > 0 && len < WARM_MESSAGE_MIN_LEN) {
      const padded = padWarmMessageToMin(raw, WARM_MESSAGE_MIN_LEN, WARM_MESSAGE_MAX_LEN);
      if (warmMessageCharCount(padded) >= WARM_MESSAGE_MIN_LEN) return padded;
    }
  }

  const last = candidates[0] ?? "오늘의 마음을 붙잡은 것만으로도 충분해요. 다정히 자신을 바라보고 있으니, 천천히 숨 깊게 쉬어 보세요.";
  return truncateWarmMessage(
    padWarmMessageToMin(last, WARM_MESSAGE_MIN_LEN, WARM_MESSAGE_MAX_LEN),
    WARM_MESSAGE_MAX_LEN
  );
}

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
이 기록과 위 사용자 정보를 반영해, 따뜻하고 긍정적인 맞춤 한마디를 한국어로 작성하세요.

필수 조건:
- 전체 길이 50자 이상 100자 이하(공백 포함, 한글 글자 수 기준)
- 톤: 다정한 공감 + 가벼운 위로 또는 작은 격려 1가지
- 오늘 기록의 핵심 단어·감정·상황을 자연스럽게 반영(목록·키워드 나열 금지)
- 성과·생산성·수익·효율 압박, 의학적 진단·단정 금지
- "오늘의 키워드:", 따옴표 나열, 점(·) 나열, "(을)를" 같은 어색한 조사 표기 금지
- 출력은 본문만(따옴표·제목·설명 없이)${profileBlock}

기록:
${text}`;
}

export function buildWarmMessageGeminiSystemPreamble(): string {
  return (
    "당신은 사용자의 자각 기록과 참고 정보를 읽고, 따뜻하고 긍정적인 맞춤 한마디를 한국어로 작성하는 도우미입니다. " +
    `반드시 ${WARM_MESSAGE_MIN_LEN}~${WARM_MESSAGE_MAX_LEN}자(공백 포함) 한 개의 짧은 문단으로만 답하세요. ` +
    "과장·단정·진단 없이 공감과 가벼운 격려를 담으세요."
  );
}

export function buildWarmMessageOpenAiSystemPrompt(): string {
  return (
    "당신은 사용자의 자각 기록을 읽고 따뜻한 긍정 메시지를 짧게 전하는 도우미입니다. " +
    `한국어로 ${WARM_MESSAGE_MIN_LEN}~${WARM_MESSAGE_MAX_LEN}자(공백 포함)만 작성하세요. ` +
    "기록 내용에 맞춘 공감과 가벼운 위로를 담고, 성과 압박·키워드 목록·어색한 조사 표기는 금지합니다."
  );
}
