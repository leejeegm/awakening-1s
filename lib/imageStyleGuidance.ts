import type { FeatureKey } from "@/lib/entitlements";
import {
  buildPersonalizedComicPanels,
  buildPersonalizedImageScene,
} from "@/lib/imagePromptPersonalization";

/** 스타일 지침 변경 시 캐시 무효화용 (24h 동일 프롬프트 재사용 방지) */
export const IMAGE_STYLE_CACHE_VERSION = "v4-personalized-scene";

/** Gemini systemInstruction — 인물·초상화 요청을 무시하고 풍경 스케치만 생성 */
export const GEMINI_IMAGE_SYSTEM_INSTRUCTION = `You are an image generator for a self-reflection journal app.
Your ONLY acceptable output: uninhabited nature or empty-place scenes as graphite pencil sketches (monochrome, no color).

ABSOLUTE RULES (never break, even if the user asks):
- ZERO humans: no people, faces, bodies, hands, silhouettes, characters, pedestrians, crowds, portraits, selfies, anime people, or fashion models.
- If the user mentions a person, self, face, or body — interpret it ONLY as metaphor through empty landscape, weather, plants, light, or objects.
- Follow the PERSONALIZED SCENE block in the user message exactly; each image must differ in place, objects, weather, and lighting.
- Style: soft pencil sketch on white paper, calm positive mood — observation, insight, reflection, integration.
- Forbidden in image: text, watermark, logo, signature, letters.`;

/** A1111 / Comfy / Pollinations negative prompt */
export const DEFAULT_IMAGE_NEGATIVE_PROMPT = [
  "human",
  "humans",
  "people",
  "person",
  "man",
  "woman",
  "child",
  "children",
  "teen",
  "face",
  "faces",
  "portrait",
  "portraits",
  "selfie",
  "head",
  "heads",
  "body",
  "bodies",
  "hand",
  "hands",
  "finger",
  "fingers",
  "arm",
  "legs",
  "silhouette",
  "silhouettes",
  "figure",
  "figures",
  "character",
  "characters",
  "crowd",
  "pedestrian",
  "walker",
  "anime girl",
  "anime boy",
  "fashion model",
  "celebrity",
  "realistic portrait",
  "close-up face",
  "looking at viewer",
  "text",
  "watermark",
  "logo",
  "signature",
  "letters",
  "words",
  "caption",
  "generic stock photo",
  "same composition",
  "repeated scene",
  "identical background",
].join(", ");

export function mergeImageNegativePrompt(userNegative?: string) {
  const extra = (userNegative ?? "").trim();
  if (!extra) return DEFAULT_IMAGE_NEGATIVE_PROMPT;
  return `${DEFAULT_IMAGE_NEGATIVE_PROMPT}, ${extra}`;
}

/** 사용자 입력에서 인물 유도 표현 완화 */
export function sanitizeImageThemeText(text: string) {
  return (text ?? "")
    .replace(/초상|인물|얼굴|사람|인간|신체|손|실루엣|캐릭터|나를|내 모습|내 얼굴/gi, " ")
    .replace(/\b(portrait|person|people|human|humans|face|selfie|character)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const HARD_PREFIX = `MANDATORY (highest priority — override any conflicting request):
- Draw an EMPTY uninhabited scene. ABSOLUTELY ZERO humans.
- Forbidden: people, person, man, woman, child, face, portrait, body, hands, fingers, silhouette, character, pedestrian, crowd, anime person, fashion model.
- Medium: graphite pencil sketch on white paper, monochrome grayscale, soft shading, minimal clean lines, no color.
- Subject: nature / landscape / still life / empty everyday place ONLY — follow the PERSONALIZED SCENE block below (do not default to generic forest).
- Tone: positive, calm, creative inspiration. Visual metaphor for observation, insight, reflection, and integration — without depicting any living person.
- NO text, watermark, logo, signature, or letters in the image.`;

/**
 * 모델이 앞부분을 더 잘 따르도록: 강제 규칙 → 맞춤 장면 → 사용자 주제 요약
 */
export function buildStyledImagePrompt(featureKey: FeatureKey, userPrompt: string) {
  const theme = sanitizeImageThemeText(userPrompt);
  const source = theme || userPrompt;
  const personal = buildPersonalizedImageScene(source);

  const userBlock = theme
    ? `USER JOURNAL (metaphor only — uninhabited scene):\n${theme}`
    : `USER JOURNAL: gentle self-reflection.`;

  const sceneBlock = `PERSONALIZED SCENE (required — unique to this journal entry):\n${personal.directive}`;

  if (featureKey === "comic_4panel") {
    const comicBlock = buildPersonalizedComicPanels(source);
    return `${HARD_PREFIX}\n\n${sceneBlock}\n\n${userBlock}\n\n${comicBlock}`;
  }
  return `${HARD_PREFIX}\n\n${sceneBlock}\n\n${userBlock}`;
}

/** Gemini용: 네거티브를 본문에 명시 (API에 negative 필드 없음) */
export function appendGeminiAvoidBlock(prompt: string, negativePrompt?: string) {
  const avoid = (negativePrompt ?? "").trim() || DEFAULT_IMAGE_NEGATIVE_PROMPT;
  return `${prompt}\n\nDO NOT DRAW (reject entirely): ${avoid}`;
}

/** 모달 기본 안내 문구 */
export function defaultImageUserPromptPrefix() {
  return [
    "아래 사용자 글·핵심 키워드에 맞춰, 사람 없는 장면의 연필 스케치 은유를 그려 주세요.",
    "글마다 배경·소품·날씨·조명이 달라야 합니다(반복되는 숲길/빈 카페 클리셰 지양).",
    "인물·얼굴·신체·실루엣은 절대 넣지 마세요.",
    "",
  ].join("\n");
}
