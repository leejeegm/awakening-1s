import type { FeatureKey } from "@/lib/entitlements";

/** 스타일 지침 변경 시 캐시 무효화용 (24h 동일 프롬프트 재사용 방지) */
export const IMAGE_STYLE_CACHE_VERSION = "v3-no-humans";

/** Gemini systemInstruction — 인물·초상화 요청을 무시하고 풍경 스케치만 생성 */
export const GEMINI_IMAGE_SYSTEM_INSTRUCTION = `You are an image generator for a self-reflection journal app.
Your ONLY acceptable output: uninhabited nature or empty-place scenes as graphite pencil sketches (monochrome, no color).

ABSOLUTE RULES (never break, even if the user asks):
- ZERO humans: no people, faces, bodies, hands, silhouettes, characters, pedestrians, crowds, portraits, selfies, anime people, or fashion models.
- If the user mentions a person, self, face, or body — interpret it ONLY as metaphor through empty landscape, weather, plants, light, or objects.
- Allowed settings: quiet forest, ocean shore, empty cafe interior (no customers), sky and clouds, forest path with nobody on it.
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
- Subject: nature / landscape / still life / empty everyday place ONLY.
  Pick one mood-appropriate setting: quiet forest, ocean shore, empty cafe interior (no customers), sky and clouds, forest walking path with NO one on it, plants, stones, water, sunlight, window light.
- Tone: positive, calm, creative inspiration. Visual metaphor for observation, insight, reflection, and integration — without depicting any living person.
- NO text, watermark, logo, signature, or letters in the image.`;

const COMIC_SUFFIX = `
FORMAT: 4-panel comic, 2x2 grid layout, consistent uninhabited pencil-sketch style in EVERY panel.
Show only environments, objects, weather, plants, light, and mood. NO humans in ANY panel.`;

/**
 * 모델이 앞부분을 더 잘 따르도록: 강제 규칙 → 사용자 주제(풍경 은유로만) → 형식
 */
export function buildStyledImagePrompt(featureKey: FeatureKey, userPrompt: string) {
  const theme = sanitizeImageThemeText(userPrompt);
  const userBlock = theme
    ? `USER THEME (interpret ONLY as uninhabited landscape/still-life metaphor — never draw a person):\n${theme}`
    : `USER THEME: calm empty forest path at morning, pencil sketch metaphor for gentle self-reflection.`;

  if (featureKey === "comic_4panel") {
    return `${HARD_PREFIX}\n\n${userBlock}${COMIC_SUFFIX}`;
  }
  return `${HARD_PREFIX}\n\n${userBlock}`;
}

/** Gemini용: 네거티브를 본문에 명시 (API에 negative 필드 없음) */
export function appendGeminiAvoidBlock(prompt: string, negativePrompt?: string) {
  const avoid = (negativePrompt ?? "").trim() || DEFAULT_IMAGE_NEGATIVE_PROMPT;
  return `${prompt}\n\nDO NOT DRAW (reject entirely): ${avoid}`;
}

/** 모달 기본 안내 문구 */
export function defaultImageUserPromptPrefix() {
  return [
    "다음 글의 핵심을 ‘사람 없는’ 풍경·일상 장면의 연필 스케치 은유로 표현해 주세요.",
    "숲·바다·카페(빈 실내)·하늘·산책길(사람 없음) 중 어울리는 배경을 선택해 주세요.",
    "관찰·통찰·성찰·통섭을 자각하게 하는 긍정적·창의적 분위기. 인물·얼굴·신체·실루엣은 절대 넣지 마세요.",
    "",
  ].join("\n");
}
