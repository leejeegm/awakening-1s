import { finalizeAiKoreanMessage } from "@/lib/aiKoreanMessageFormat";
import { finalizeWarmMessage } from "@/lib/warmMessageFormat";

type ProfileHint = {
  genderLabel?: string | null;
  ageLabel?: string | null;
};

/** 같은 기록이면 같은 톤 조합을 쓰되, 매번 패턴만 바뀌지 않도록 시드 활용 */
function seedFromNotes(notes: string[]): number {
  const s = notes.slice(0, 12).join("\u241e");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) >>> 0;
}

function pickSeeded<T>(arr: readonly T[], seed: number, salt: number): T {
  if (arr.length === 0) throw new Error("empty pick");
  return arr[(seed + salt * 1103515245) % arr.length] as T;
}

function tokenizeKoreanish(text: string): string[] {
  return text
    .replace(/[\s.,!?;:'"()[\]{}<>\\/\-|_+=~`@#$%^&*]+/g, " ")
    .split(" ")
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);
}

function normalizeKeyword(word: string): string {
  const cleaned = word
    .trim()
    .replace(/^[“"'‘’`]+|[“"'‘’`]+$/g, "")
    .replace(
      /(이라고|라고|이라는|라는|으로는|로는|에게서|한테서|에서|에게|한테|으로|로|부터|까지|처럼|같이|보다|마저|조차|이나|나|와|과|도|만|은|는|이|가|을|를|에)$/u,
      ""
    )
    .trim();
  return cleaned.length >= 2 ? cleaned : word.trim();
}

function topKeywords(notes: string[], limit = 5): string[] {
  const map = new Map<string, number>();
  const stopwords = new Set([
    "오늘",
    "지금",
    "먼저",
    "다음",
    "기록",
    "기분",
    "마음",
    "생각",
    "정말",
    "너무",
    "그냥",
    "조금",
    "한번",
    "한",
  ]);
  for (const n of notes) {
    for (const w of tokenizeKoreanish(n)) {
      const normalized = normalizeKeyword(w);
      if (normalized.length < 2 || stopwords.has(normalized)) continue;
      map.set(normalized, (map.get(normalized) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

function profileBridge(hint?: ProfileHint): string {
  const g = hint?.genderLabel;
  const a = hint?.ageLabel;
  if (!g && !a) return "";
  const frag = [g, a].filter(Boolean).join(", ");
  return pickSeeded(
    [
      ` 지금 이야기는 ${frag} 흐름 안에서도 충분히 공감될 거예요.`,
      ` ${frag} 경험과 맞닿는 부분이 있을 수 있어요.`,
      ` ${frag} 시선에서도 자연스럽게 읽혀요.`,
    ],
    seedFromNotes([frag]),
    3
  );
}

export function buildRuleBasedWarmMessage(args: {
  notes: string[];
  durationType: "1s" | "10s" | "100s";
  profileHint?: ProfileHint;
}): string {
  const { notes, durationType, profileHint } = args;
  const seed = seedFromNotes(notes);
  const kws = topKeywords(notes, 5);
  const kw = kws.length ? pickSeeded(kws, seed, 1) : "";
  const focus =
    durationType === "1s"
      ? "순간"
      : durationType === "10s"
        ? "흐름"
        : "방향";
  const tone =
    profileHint?.ageLabel && profileHint.ageLabel.includes("10")
      ? "가볍게"
      : profileHint?.genderLabel
        ? "다정히"
        : "천천히";

  const withKw = kw
    ? [
        `오늘 ${focus}에 「${kw}」 마음이 또렷해요. ${tone} 숨 한 번 더 깊게 쉬며 스스로를 응원해 보세요.`,
        `기록 속 「${kw}」에서 따뜻한 결이 느껴져요. 잘하고 있어요, ${tone} 마음 편히 쉬어 가도 괜찮아요.`,
        `「${kw}」를 붙잡은 오늘 ${focus}, 충분히 의미 있어요. ${tone} 자신을 다정히 바라봐 주세요.`,
      ]
    : [
        `오늘 ${focus}을 붙잡은 것만으로도 충분해요. ${tone} 숨 깊게 쉬며 스스로를 응원해 보세요.`,
        `짧은 기록에도 마음이 잘 전해져요. 잘하고 있어요, ${tone} 오늘을 다정히 인정해 주세요.`,
        `스스로를 놓치지 않으려는 마음이 보여요. ${tone} 천천히 숨 쉬며 오늘을 가볍게 안아 주세요.`,
      ];

  return finalizeWarmMessage(pickSeeded(withKw, seed, 0), ...withKw);
}

export function buildRuleBasedInsightCard(args: {
  notes: string[];
  nickname?: string;
  profileHint?: ProfileHint;
}): string {
  const { notes, profileHint } = args;
  const seed = seedFromNotes(notes);
  const kws = topKeywords(notes, 6);
  const k1 = kws[0] ?? "마음";
  const tone = profileHint?.genderLabel ? "당신" : "당신";

  const cards = [
    `기록 속 「${k1}」이 오늘을 따뜻하게 비추고 있어요. ${tone}의 걸음을 조용히 응원합니다.`,
    `「${k1}」 주변에서 스스로를 다정히 붙잡고 있네요. 그 마음이 이미 충분히 빛나요.`,
    `짧은 문장마다 「${k1}」의 결이 스며 있어요. 오늘의 당신에게 고요한 용기를 보냅니다.`,
    `오늘의 흐름은 「${k1}」 쪽으로 부드럽게 모입니다. 천천히 숨 쉬며 자신을 안아 주세요.`,
  ];
  return finalizeAiKoreanMessage(pickSeeded(cards, seed, 0), ...cards);
}

export function buildRuleBasedWeeklySummary(notes: string[]): string {
  const kws = topKeywords(notes, 8);
  if (notes.length === 0) return "이번 주 기록이 없어 요약할 내용이 없습니다.";
  const seed = seedFromNotes(notes);
  const k1 = kws[0] ?? "마음";

  const summaries = [
    `이번 주는 「${k1}」이 자주 스며든 한 주였어요. 다음 주도 당신의 걸음을 조용히 응원합니다.`,
    `기록마다 「${k1}」의 결이 이어졌어요. 이번 주를 다정히 마무리하며 숨 한 번 깊게 쉬어 보세요.`,
    `한 주 동안 「${k1}」을 붙잡으며 스스로를 돌보셨네요. 그 마음이 다음 주의 빛이 될 거예요.`,
    `이번 주의 흐름은 부드러웠어요. 「${k1}」처럼 남는 감각 하나만 이어 가도 충분합니다.`,
  ];
  return finalizeAiKoreanMessage(pickSeeded(summaries, seed, 0), ...summaries);
}
