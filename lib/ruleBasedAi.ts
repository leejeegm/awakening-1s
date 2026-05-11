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
  const kwFrag = kws.length ? kws.slice(0, 3).join(", ") : "";
  const focus =
    durationType === "1s"
      ? "순간의 감각"
      : durationType === "10s"
        ? "이어지는 흐름"
        : "잡아가는 방향";

  const openers = [
    `오늘 남긴 기록에는 이미 ${focus}을 알아차리는 힘이 담겨 있어요.${profileBridge(profileHint)}`,
    `짧은 문장 안에도 오늘 마음이 어디를 향하는지 충분히 전해져요.${profileBridge(profileHint)}`,
    `지금 적어 둔 몇 줄만으로도, 스스로를 꽤 다정하게 바라보고 있다는 게 느껴져요.${profileBridge(profileHint)}`,
    `오늘의 찰나를 그냥 지나치지 않고 붙잡아 둔 것만으로도 이미 중요한 걸 해낸 거예요.${profileBridge(profileHint)}`,
  ];
  const middles =
    kwFrag.length > 0
      ? [
          `특히 「${pickSeeded(kws, seed, 1)}」라는 단어 주변에서 붙잡고 싶은 마음의 결이 선명하게 느껴져요.`,
          `오늘 기록에서는 「${pickSeeded(kws, seed, 2)}」 쪽으로 마음이 자연스럽게 기울고 있는 듯해요.`,
          `문장 사이사이에서 「${pickSeeded(kws, seed, 3)}」를 놓치고 싶지 않은 마음이 조용히 이어져요.`,
        ]
      : [
          `오늘의 기록은 작은 변화의 신호를 부드럽게 알려 주는 쪽에 가까워 보여요.`,
          `짧은 문장이지만, 스스로를 놓치지 않으려는 마음이 또렷하게 읽혀요.`,
        ];

  const closers = [
    `너무 빨리 정리하거나 잘하려고 애쓰지 않아도 괜찮아요. 다음 한 번은 가장 먼저 남고 싶은 단어 하나만 적고, 그때 닿은 느낌을 한 문장만 덧붙여 보세요.`,
    `지금 필요한 건 더 많은 설명보다 한 번의 다정한 포착일 수 있어요. 다음 기록은 가장 먼저 떠오르는 단어 하나와 그 순간의 숨결 한 줄이면 충분해요.`,
    `오늘의 감각을 있는 그대로 믿어 보세요. 다음에는 그 순간에 가까웠던 단어 하나를 먼저 적고, 왜 마음에 남았는지만 짧게 이어 보아도 좋아요.`,
    `성과나 결론까지 한 번에 가려 하지 않아도 괜찮아요. 오늘 붙잡힌 감각 하나를 먼저 적고, 그 뒤에 마음의 온도를 한 문장만 남겨 보세요.`,
  ];

  const o = pickSeeded(openers, seed, 0);
  const m = pickSeeded(middles, seed, 4);
  const c = pickSeeded(closers, seed, 5);
  return [o, m, c].join(" ");
}

export function buildRuleBasedInsightCard(args: {
  notes: string[];
  nickname?: string;
  profileHint?: ProfileHint;
}): string {
  const { notes, nickname, profileHint } = args;
  const seed = seedFromNotes(notes);
  const kws = topKeywords(notes, 6);
  const k1 = kws[0] ?? "관찰";
  const k2 = kws[1] ?? "흐름";
  const title = nickname ? "맞춤 감응 스냅샷" : "이번 감응 트렌드 스냅샷";

  const leads = [
    `${title}: 기록 안에서 「${k1}」와 「${k2}」가 서로를 부드럽게 비추고 있어요.${profileBridge(profileHint)}`,
    `${title}: 지금은 「${k1}」 쪽으로 마음이 모이고, 그 주변에서 「${k2}」가 조용히 힘을 보태는 흐름이에요.${profileBridge(profileHint)}`,
    `${title}: 여러 줄이 한데 모이며 「${k1}」이라는 감각이 오늘의 중심을 따뜻하게 잡아 주고 있어요.${profileBridge(profileHint)}`,
  ];
  const bodies = [
    `이 흐름을 조금 더 살리고 싶다면, 다음 기록에는 마음에 남는 단어 하나와 그때의 느낌 한 줄만 가볍게 적어 보세요.`,
    `오늘의 감각을 너무 해석하려 애쓰지 않아도 괜찮아요. 다음엔 가장 오래 남는 단어 하나만 먼저 적어 보아도 충분해요.`,
    `지금의 기록만으로도 이미 충분히 의미가 있어요. 다음엔 내일의 나에게 건네는 짧은 한마디처럼 이어 적어 보아도 좋아요.`,
  ];
  return `${pickSeeded(leads, seed, 0)} ${pickSeeded(bodies, seed, 1)}`.trim();
}

export function buildRuleBasedWeeklySummary(notes: string[]): string {
  const kws = topKeywords(notes, 8);
  if (notes.length === 0) return "이번 주 기록이 없어 요약할 내용이 없습니다.";
  const seed = seedFromNotes(notes);
  const mood = pickSeeded(
    [
      "차분하게 관찰을 쌓아가는 한 주",
      "작은 변화에 귀 기울이는 한 주",
      "방향을 스스로 조율해 가는 한 주",
      "감각의 언어를 조금씩 넓혀 가는 한 주",
    ],
    seed,
    0
  );
  const kwLine =
    kws.length > 0
      ? pickSeeded(
          [
            `기록 속에서 「${kws.slice(0, 3).join(" · ")}」 같은 단서들이 반복적으로 손을 흔들어요.`,
            `이번 주 자주 등장한 감각의 단어는 ${kws.slice(0, 4).join(", ")} 쪽에 가까워 보여요.`,
          ],
          seed,
          1
        )
      : `이번 주는 짧은 문장들이 모여 전체적인 기분의 윤곽을 만들고 있어요.`;

  const next = pickSeeded(
    [
      "다음 주에는 가장 오래 남는 감각 하나만 골라, 하루에 한 줄씩만 적어 보세요. 그 정도면 충분해요.",
      "다음 주에는 하루쯤 ‘오늘의 나에게 고맙다’고 적는 날을 만들어 보아도 좋아요.",
      "다음 주는 기록 길이보다 먼저 떠오르는 한 단어를 제목처럼 붙여 보는 실험을 해 보세요.",
    ],
    seed,
    2
  );

  return `이번 주는 ${mood}로 느껴져요. ${kwLine} ${next}`;
}
