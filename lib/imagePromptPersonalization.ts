/** 사용자 기록·키워드마다 다른 풍경/소품/조명을 강제하는 이미지 맞춤 지시 */

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) >>> 0;
}

function pickSeeded<T>(arr: readonly T[], seed: number, salt: number): T {
  return arr[(seed + salt * 1103515245) % arr.length] as T;
}

function tokenize(text: string): string[] {
  return text
    .replace(/[\s.,!?;:'"()[\]{}\-\u3000-\u303f\uff00-\uffef]+/g, " ")
    .split(" ")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 2);
}

const STOP = new Set([
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
  "하는",
  "있는",
  "없는",
  "것을",
  "위해",
]);

export function extractImageKeywords(text: string, limit = 6): string[] {
  const map = new Map<string, number>();
  for (const w of tokenize(text)) {
    if (STOP.has(w)) continue;
    map.set(w, (map.get(w) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

type SceneArchetype = {
  id: string;
  triggers: string[];
  settings: string[];
  focalObjects: string[];
  lighting: string[];
  mood: string[];
};

const SCENES: SceneArchetype[] = [
  {
    id: "ocean_shore",
    triggers: ["바다", "파도", "해변", "물", "해", "섬", "조개", "모래"],
    settings: [
      "empty rocky shoreline with gentle waves, no people",
      "wide tidal flat at low tide with distant horizon, uninhabited",
    ],
    focalObjects: ["driftwood", "smooth stones", "seaweed clusters", "shells on wet sand"],
    lighting: ["overcast soft light", "golden hour glow on water", "cool blue morning haze"],
    mood: ["open, reflective calm", "quiet hope after release"],
  },
  {
    id: "forest_path",
    triggers: ["숲", "나무", "숲속", "산", "등산", "길", "산책", "녹음", "잎"],
    settings: [
      "narrow forest walking path vanishing into trees, nobody present",
      "mossy clearing surrounded by tall trunks, empty bench optional",
    ],
    focalObjects: ["ferns", "fallen leaves", "mushrooms on a log", "sunbeams through branches"],
    lighting: ["dappled afternoon light", "misty morning in woods", "soft rain-filtered green light"],
    mood: ["grounded introspection", "gentle renewal"],
  },
  {
    id: "cafe_interior",
    triggers: ["카페", "커피", "차", "찻잔", "테이블", "창가", "실내", "책"],
    settings: [
      "empty corner of a small cafe, chairs stacked, no customers",
      "window seat table with cup and notebook, shop closed feeling",
    ],
    focalObjects: ["steam from a cup", "open notebook", "potted plant on sill", "rain on window glass"],
    lighting: ["warm lamp light indoors", "cool daylight through window", "evening amber interior"],
    mood: ["cozy pause", "quiet creative focus"],
  },
  {
    id: "sky_clouds",
    triggers: ["하늘", "구름", "날씨", "바람", "해질", "새벽", "노을", "별"],
    settings: [
      "wide open sky above empty rooftop or hill, no figures",
      "layered cumulus clouds over distant low hills, uninhabited",
    ],
    focalObjects: ["bird silhouettes far away", "kite string on ground without person", "weather vane"],
    lighting: ["dramatic sunset gradient", "bright midday blue", "pre-dawn violet horizon"],
    mood: ["expansive clarity", "lightness and possibility"],
  },
  {
    id: "rain_city",
    triggers: ["비", "우산", "젖", "슬픔", "눈물", "쓸쓸", "외로"],
    settings: [
      "empty wet street reflecting lights, no pedestrians",
      "park pavilion after rain, puddles on stone floor",
    ],
    focalObjects: ["raindrops on leaves", "closed umbrella leaning on bench", "ripples in puddle"],
    lighting: ["grey diffuse rain light", "streetlamp reflections at dusk"],
    mood: ["melancholy softening into calm", "cleansing quiet"],
  },
  {
    id: "garden_flowers",
    triggers: ["꽃", "봄", "향", "정원", "화분", "풀", "벚꽃", "개화"],
    settings: [
      "small walled garden with flowers, no gardener present",
      "window box and stone path in courtyard, empty",
    ],
    focalObjects: ["single blooming branch", "watering can", "butterfly near petals"],
    lighting: ["bright spring morning", "soft overcast on petals"],
    mood: ["tender growth", "gentle encouragement"],
  },
  {
    id: "lake_mist",
    triggers: ["호수", "연못", "안개", "고요", "평온", "명상", "호흡"],
    settings: [
      "still lake with mist and reeds, empty shore",
      "small dock without boats, mirror water surface",
    ],
    focalObjects: ["lily pads", "smooth pebbles", "single leaf on water"],
    lighting: ["early misty dawn", "muted silver afternoon"],
    mood: ["deep stillness", "integration and breath"],
  },
  {
    id: "desk_stilllife",
    triggers: ["일", "공부", "책상", "펜", "글", "계획", "목표", "프로젝트"],
    settings: [
      "minimal desk still life by window, chair empty",
      "stacked books and lamp on table, room uninhabited",
    ],
    focalObjects: ["pen and paper", "hourglass", "glasses", "sticky notes"],
    lighting: ["desk lamp cone of light", "neutral daylight on workspace"],
    mood: ["focused calm", "small next step"],
  },
];

function scoreArchetype(arch: SceneArchetype, keywords: string[], fullText: string): number {
  let score = 0;
  const blob = `${keywords.join(" ")} ${fullText}`.toLowerCase();
  for (const t of arch.triggers) {
    if (blob.includes(t)) score += 3;
  }
  for (const kw of keywords) {
    if (arch.triggers.some((t) => kw.includes(t) || t.includes(kw))) score += 2;
  }
  return score;
}

function selectArchetype(keywords: string[], fullText: string, seed: number): SceneArchetype {
  const ranked = SCENES.map((a) => ({ a, score: scoreArchetype(a, keywords, fullText) }))
    .sort((x, y) => y.score - x.score);
  const top = ranked[0];
  if (top && top.score > 0) {
    const ties = ranked.filter((r) => r.score === top.score).map((r) => r.a);
    return pickSeeded(ties, seed, 1);
  }
  return pickSeeded(SCENES, seed, 2);
}

export type PersonalizedImageScene = {
  archetypeId: string;
  variantId: string;
  keywords: string[];
  directive: string;
};

/**
 * 사용자 문구·키워드에서 구체적 무인 장면 지시문 생성 (매 텍스트마다 달라지도록)
 */
export function buildPersonalizedImageScene(userText: string): PersonalizedImageScene {
  const trimmed = (userText ?? "").trim();
  const keywords = extractImageKeywords(trimmed, 8);
  const seed = hashSeed(trimmed || "default");
  const arch = selectArchetype(keywords, trimmed, seed);

  const setting = pickSeeded(arch.settings, seed, 3);
  const focal = pickSeeded(arch.focalObjects, seed, 4);
  const light = pickSeeded(arch.lighting, seed, 5);
  const mood = pickSeeded(arch.mood, seed, 6);
  const kwLine =
    keywords.length > 0
      ? `Journal keywords to reflect visually (objects/weather/mood only, never people): ${keywords.join(", ")}.`
      : "Journal theme: gentle self-reflection and quiet positive insight.";

  const variantId = `${arch.id}-${(seed % 997).toString(36)}`;
  const directive = [
    `SCENE ID: ${variantId} — draw THIS exact uninhabited scene (not a generic template).`,
    `Setting: ${setting}.`,
    `Hero objects / focal detail: ${focal}.`,
    `Lighting & time: ${light}.`,
    `Emotional tone: ${mood}.`,
    kwLine,
    "Composition must differ from a generic forest path or empty cafe unless this SCENE ID says so.",
  ].join("\n");

  return { archetypeId: arch.id, variantId, keywords, directive };
}

/** 4컷: 키워드·시드로 패널별 다른 소품/시간대 */
export function buildPersonalizedComicPanels(userText: string): string {
  const base = buildPersonalizedImageScene(userText);
  const seed = hashSeed(userText);
  const kws = base.keywords;
  const k0 = kws[0] ?? "beginning";
  const k1 = kws[1] ?? kws[0] ?? "middle";
  const k2 = kws[2] ?? "shift";
  const k3 = kws[3] ?? kws[0] ?? "integration";

  const panels = [
    `Panel 1 (setup): ${pickSeeded(SCENES, seed, 10).settings[0]} — metaphor for 「${k0}」, morning light.`,
    `Panel 2 (deepen): ${pickSeeded(SCENES, seed, 11).settings[0]} — metaphor for 「${k1}」, different angle/objects.`,
    `Panel 3 (turn): ${pickSeeded(SCENES, seed, 12).settings[0]} — metaphor for 「${k2}」, weather or light changes.`,
    `Panel 4 (resolve): ${base.directive.split("\n").slice(0, 3).join(" ")} — metaphor for 「${k3}」, calm closure.`,
  ];

  return [
    "FORMAT: 4-panel comic, 2x2 grid. Each panel MUST show a DIFFERENT uninhabited place, objects, and lighting.",
    "NO humans in any panel. Pencil sketch, monochrome.",
    ...panels,
  ].join("\n");
}
