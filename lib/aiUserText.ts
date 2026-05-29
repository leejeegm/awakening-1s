/** 맞춤 메시지·주간 요약에 쓸 최소 글자 수(이하이면 룰 폴백) */
export const AI_USER_TEXT_MIN_LEN = 35;

const INTERNAL_LINE_PATTERNS = [
  /정밀\s*(진단\s*)?모델 호출에 실패/i,
  /일시적 문제로 룰베이스 제공/i,
  /룰베이스 제공/i,
  /1차 결과로 제공 중/i,
  /^warning[:\s]/i,
];

export function sanitizeAiUserText(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !INTERNAL_LINE_PATTERNS.some((pattern) => pattern.test(line)))
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .trim();
}

function aiUserTextCharCount(text: string): number {
  return Array.from(sanitizeAiUserText(text)).length;
}

export function isTooShortAiUserText(text: string): boolean {
  return aiUserTextCharCount(text) < AI_USER_TEXT_MIN_LEN;
}

export function looksAwkwardAiUserText(text: string): boolean {
  const t = sanitizeAiUserText(text);
  const len = aiUserTextCharCount(t);
  return (
    !t ||
    isTooShortAiUserText(t) ||
    (len < 50 && /[,，、]$/.test(t)) ||
    /\(을\)를|\(이\)가|\(은\)는|\(와\)과/.test(t) ||
    /오늘의 키워드[:：]/.test(t) ||
    /키워드[:：].+·.+/.test(t) ||
    /"[^"]+"\s*(을|를|이|가)\(/.test(t)
  );
}

export function chooseAiUserText(primary: string | null | undefined, fallback: string) {
  const sanitizedFallback = sanitizeAiUserText(fallback);
  const sanitizedPrimary = sanitizeAiUserText(primary ?? "");

  if (!sanitizedPrimary || looksAwkwardAiUserText(sanitizedPrimary)) {
    return {
      text: sanitizedFallback,
      usedPrimary: false,
      primaryWasAwkward: sanitizedPrimary.length > 0,
    };
  }

  return {
    text: sanitizedPrimary,
    usedPrimary: true,
    primaryWasAwkward: false,
  };
}
