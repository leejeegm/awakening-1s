import { sanitizeAiUserText } from "@/lib/aiUserText";

/** AI 사용자-facing 한국어 메시지 공통 상한 */
export const AI_KOREAN_MAX_LEN = 100;

/** 너무 짧은 룰 폴백 보정용(선택) */
export const AI_KOREAN_SOFT_MIN_LEN = 35;

export function aiKoreanCharCount(text: string): number {
  return Array.from(sanitizeAiUserText(text)).length;
}

export const AI_KOREAN_STYLE_RULES = `- 전체 길이 100자 이내(공백 포함, 한글 글자 수 기준). 한 문단만 출력.
- 한국어 맞춤법·띄어쓰기·조사를 자연스럽게. 어색한 "(을)를", "(이)가" 표기 금지.
- 사용자 기록·맥락에 맞는 진심 어린 공감. 읽는 이의 마음이 조용히 움직이는 감동적인 톤(과장·유혈·진단·단정 금지).
- "오늘의 키워드:", 따옴표 나열, 점(·) 나열, 성과·생산성·수익 압박 금지.
- 출력은 본문만(제목·따옴표·설명 없이).`;

export function buildAiKoreanGeminiPreamble(role: string): string {
  return (
    `${role} ` +
    `한국어로만, 100자 이내 한 문단으로 답하세요. ` +
    "맞춤법과 문맥을 지키고, 따뜻하고 감동적인 문장으로 작성하세요. 과학적 단정·의학 진단은 금지합니다."
  );
}

export function buildAiKoreanOpenAiSystem(role: string): string {
  return (
    `${role} ` +
    "한국어 100자 이내, 한 문단만. 맞춤법·띄어쓰기·조사를 자연스럽게 하고, 기록 맥락에 맞게 감동적으로 다듬으세요. " +
    "키워드 나열·보고서 톤·성과 압박은 금지합니다."
  );
}

function truncateAiKorean(text: string, max: number): string {
  const chars = Array.from(sanitizeAiUserText(text));
  if (chars.length <= max) return chars.join("");
  const slice = chars.slice(0, max).join("");
  const punct = ["。", ".", "!", "?", "요", "요.", "요!", "요?", "다", "다.", "다!", "다?", "죠", "죠."];
  for (const p of punct) {
    const idx = slice.lastIndexOf(p);
    if (idx >= Math.floor(max * 0.5)) return slice.slice(0, idx + p.length).trim();
  }
  return slice.trim();
}

function padSoftMin(text: string, min: number, max: number): string {
  const suffixes = [" 오늘의 마음, 충분히 응원해요.", " 당신의 걸음을 믿어요."];
  let t = sanitizeAiUserText(text);
  for (const s of suffixes) {
    if (aiKoreanCharCount(t) >= min) break;
    if (aiKoreanCharCount(t) + aiKoreanCharCount(s) <= max) t = `${t}${s}`;
  }
  return truncateAiKorean(t, max);
}

/** AI·룰 결과를 100자 이내로 맞춤 */
export function finalizeAiKoreanMessage(primary: string, ...fallbacks: string[]): string {
  const max = AI_KOREAN_MAX_LEN;
  const min = AI_KOREAN_SOFT_MIN_LEN;
  const candidates = [primary, ...fallbacks].map((s) => sanitizeAiUserText(s)).filter(Boolean);

  for (const raw of candidates) {
    const len = aiKoreanCharCount(raw);
    if (len > 0 && len <= max) {
      if (len >= min) return raw;
      const padded = padSoftMin(raw, min, max);
      if (aiKoreanCharCount(padded) <= max) return padded;
    }
    if (len > max) {
      const cut = truncateAiKorean(raw, max);
      if (aiKoreanCharCount(cut) >= min || aiKoreanCharCount(cut) > 0) return cut;
    }
  }

  const fallback =
    "오늘 남긴 마음이 고스란히 전해져요. 스스로를 다정히 바라보는 당신에게, 조용한 응원을 보냅니다.";
  return truncateAiKorean(padSoftMin(fallback, min, max), max);
}
