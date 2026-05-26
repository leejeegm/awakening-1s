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
        `지금 이 ${focus}, 「${kw}」 마음이 고스란히 느껴져요. ${tone} 숨 한 번 깊게 쉬어도 괜찮아요.`,
        `오늘 적은 「${kw}」에 마음이 담겨 있네요. ${tone} 오늘의 당신을 다정히 안아 주세요.`,
        `이 찰나의 「${kw}」, 충분히 소중해요. ${tone} 지금 이 순간을 따뜻하게 인정해 주세요.`,
      ]
    : [
        `오늘 이 ${focus}을 붙잡은 것만으로 충분해요. ${tone} 지금 숨 깊게 쉬며 스스로를 응원해 보세요.`,
        `짧은 오늘의 기록에도 마음이 전해져요. ${tone} 지금 이 순간, 괜찮다고 말해 주세요.`,
        `스스로를 놓치지 않은 오늘이에요. ${tone} 잠시 눈을 감고 마음을 쉬어 가도 좋아요.`,
      ];

  return finalizeWarmMessage(pickSeeded(withKw, seed, 0), ...withKw);
}

export function buildRuleBasedInsightCard(args: {
  notes: string[];
  nickname?: string;
  profileHint?: ProfileHint;
}): string {
  const { notes } = args;
  const seed = seedFromNotes(notes);
  const kws = topKeywords(notes, 6);
  const k1 = kws[0] ?? "마음";
  const k2 = kws[1] ?? "흐름";

  const cards = [
    `쌓인 기록에서 「${k1}」와 「${k2}」가 조용히 이어져요. 당신만의 감응 방향이 스며들고 있어요.`,
    `「${k1}」을 중심으로 마음이 다시 모이는 패턴이 보여요. 작은 통찰이 다음 걸음을 비출 거예요.`,
    `여러 줄 사이 「${k1}」의 결이 반복돼요. 스스로를 돌보는 힘이 조금씩 자라고 있어요.`,
    `기록의 흐름은 「${k1}」 쪽으로 부드럽게 기울어요. 이어지는 여정을 조용히 응원합니다.`,
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
