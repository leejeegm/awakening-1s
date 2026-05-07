type ProfileHint = {
  genderLabel?: string | null;
  ageLabel?: string | null;
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function tokenizeKoreanish(text: string): string[] {
  return text
    .replace(/[\s.,!?;:'"()[\]{}<>\\/\-|_+=~`@#$%^&*]+/g, " ")
    .split(" ")
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);
}

function topKeywords(notes: string[], limit = 5): string[] {
  const map = new Map<string, number>();
  for (const n of notes) {
    for (const w of tokenizeKoreanish(n)) {
      map.set(w, (map.get(w) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

function profileSuffix(hint?: ProfileHint): string {
  const g = hint?.genderLabel ? ` ${hint.genderLabel}` : "";
  const a = hint?.ageLabel ? ` ${hint.ageLabel}` : "";
  const s = `${g}${a}`.trim();
  return s ? ` (${s} 기준 공감 포인트를 가볍게 반영)` : "";
}

export function buildRuleBasedWarmMessage(args: {
  notes: string[];
  durationType: "1s" | "10s" | "100s";
  profileHint?: ProfileHint;
}): string {
  const { notes, durationType, profileHint } = args;
  const kws = topKeywords(notes, 4);
  const kwLine = kws.length ? `오늘의 키워드: ${kws.join(" · ")}.` : "";
  const focus =
    durationType === "1s"
      ? "찰나의 감각"
      : durationType === "10s"
        ? "흐름의 연결"
        : "의도의 방향";

  const first = pick([
    `좋아요. 지금의 ${focus}을(를) 이미 포착하고 있어요.${profileSuffix(profileHint)}`,
    `오늘 기록을 보면 ${focus}이(가) 또렷해졌어요.${profileSuffix(profileHint)}`,
    `지금의 관찰은 충분히 의미 있어요. ${focus}을(를) 놓치지 않았네요.${profileSuffix(profileHint)}`,
  ]);

  const second = pick([
    `다음 한 번은 ${kws[0] ? `"${kws[0]}"` : "그 순간"}을(를) 한 단어로 먼저 붙잡고, 그 뒤에 한 문장만 덧붙여 보세요.`,
    `지금처럼 짧게 적되, “왜” 대신 “무엇이 느껴졌는지”를 한 줄 더 남겨보면 성장이 빨라져요.`,
    `오늘의 패턴을 한 번만 더 반복해 보세요. 같은 형식으로 1줄 기록만 추가해도 충분합니다.`,
  ]);

  return [first, kwLine, second].filter(Boolean).join(" ");
}

export function buildRuleBasedInsightCard(args: {
  notes: string[];
  nickname?: string;
  profileHint?: ProfileHint;
}): string {
  const { notes, nickname, profileHint } = args;
  const kws = topKeywords(notes, 5);
  const title = nickname ? "맞춤 감응" : "이번 감응 트렌드";
  const lead = pick([
    `${title}: 지금은 “${kws[0] ?? "관찰"}”의 비중이 높아요.${profileSuffix(profileHint)}`,
    `${title}: 기록에서 “${kws[0] ?? "흐름"}”이(가) 반복됩니다.${profileSuffix(profileHint)}`,
  ]);
  const body = pick([
    `핵심 키워드(${kws.slice(0, 3).join(", ") || "기록 축적"})를 기준으로, 다음 기록은 “하나의 행동 + 하나의 감정” 형태로 더 선명하게 만들어 보세요.`,
    `키워드(${kws.slice(0, 3).join(", ") || "기록"})가 모이고 있어요. 오늘은 그중 하나만 골라 10초만 더 머물러 보세요.`,
  ]);
  return `${lead} ${body}`.trim();
}

export function buildRuleBasedWeeklySummary(notes: string[]): string {
  const kws = topKeywords(notes, 6);
  if (notes.length === 0) return "이번 주 기록이 없어 요약할 내용이 없습니다.";
  const mood = pick([
    "차분하게 관찰을 쌓아가는 흐름",
    "작은 변화에 민감하게 반응하는 흐름",
    "의도적으로 방향을 잡아가는 흐름",
  ]);
  const line1 = `이번 주는 ${mood}이(가) 보입니다.`;
  const line2 = kws.length ? `반복 키워드는 ${kws.slice(0, 4).join(", ")}입니다.` : "";
  const line3 = "다음 주는 키워드 하나를 정해 같은 패턴으로 3번만 더 기록해 보세요.";
  return [line1, line2, line3].filter(Boolean).join(" ");
}

