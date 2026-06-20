/** 기록 모달 AI 감응 유형 추천 — 찰나(1s/10s/100s)별 디바운스·입력 임계 */

export type DurationSuggestType = "1s" | "10s" | "100s";

export type ResonanceSuggestConfig = {
  debounceMs: number;
  minChars?: number;
  minWords?: number;
  /** 띄어쓰기 없는 한국어 보조: 단어 수 미달 시 글자 수로 판단 */
  minCharsFallback?: number;
  waitingHint: string;
  thresholdHint: string;
};

export const RESONANCE_SUGGEST_BY_DURATION: Record<DurationSuggestType, ResonanceSuggestConfig> = {
  "1s": {
    debounceMs: 1000,
    minChars: 6,
    waitingHint: "약 1초",
    thresholdHint: "6자 이상 입력 후 추천·자동 선택",
  },
  "10s": {
    debounceMs: 2000,
    minWords: 2,
    minCharsFallback: 10,
    waitingHint: "약 2초",
    thresholdHint: "2단어(또는 10자) 이상 입력 후 추천·자동 선택",
  },
  "100s": {
    debounceMs: 3000,
    minWords: 4,
    minCharsFallback: 24,
    waitingHint: "약 3초",
    thresholdHint: "4단어(또는 24자) 이상 입력 후 추천·자동 선택",
  },
};

export function normalizeDurationSuggestType(raw: string | undefined | null): DurationSuggestType {
  if (raw === "10s" || raw === "100s") return raw;
  return "1s";
}

export function getResonanceSuggestConfig(duration: string | undefined | null): ResonanceSuggestConfig {
  return RESONANCE_SUGGEST_BY_DURATION[normalizeDurationSuggestType(duration)];
}

export function countNoteWords(note: string): number {
  return note.trim().split(/\s+/).filter(Boolean).length;
}

export function isNoteReadyForResonanceSuggest(
  note: string,
  duration: string | undefined | null
): boolean {
  const text = note.trim();
  if (!text) return false;
  const cfg = getResonanceSuggestConfig(duration);
  if (cfg.minChars != null && text.length >= cfg.minChars) return true;
  if (cfg.minWords != null) {
    if (countNoteWords(text) >= cfg.minWords) return true;
    if (cfg.minCharsFallback != null && text.length >= cfg.minCharsFallback) return true;
  }
  return false;
}
