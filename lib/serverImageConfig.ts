import type { FeatureKey } from "@/lib/entitlements";

function clampIntEnv(name: string, fallback: number, min: number, max: number) {
  const n = Number(process.env[name] ?? String(fallback));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clampBoolEnv(name: string, fallback: boolean) {
  const v = (process.env[name] ?? "").trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return fallback;
}

/** Vercel Hobby 등 짧은 함수 제한에 맞춘 서버 생성 기본값 */
export function getServerImageConfig() {
  return {
    /** fetch(txt2img) 타임아웃(ms). Hobby는 9000 권장 */
    engineTimeoutMs: clampIntEnv("IMAGE_SERVER_TIMEOUT_MS", 9000, 3000, 55000),
    maxSteps: clampIntEnv("IMAGE_SERVER_MAX_STEPS", 14, 8, 40),
    imageWidth: clampIntEnv("IMAGE_SERVER_IMAGE_WIDTH", 512, 256, 1024),
    imageHeight: clampIntEnv("IMAGE_SERVER_IMAGE_HEIGHT", 512, 256, 1024),
    comicSize: clampIntEnv("IMAGE_SERVER_COMIC_SIZE", 512, 256, 1024),
    /** true면 POST /api/ai/image 가 작업 큐(job)만 만들고 클라이언트가 폴링 */
    asyncDefault: clampBoolEnv("IMAGE_SERVER_ASYNC", true),
    /** running 상태가 이 시간보다 길면 pending 으로 되돌려 재시도 */
    jobStaleMs: clampIntEnv("IMAGE_SERVER_JOB_STALE_MS", 120_000, 30_000, 600_000),
    pollIntervalMs: clampIntEnv("IMAGE_SERVER_POLL_INTERVAL_MS", 2500, 1000, 10_000),
    pollMaxMs: clampIntEnv("IMAGE_SERVER_POLL_MAX_MS", 120_000, 15_000, 300_000),
  };
}

export function clampRequestInt(v: unknown, min: number, max: number, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function resolveServerDimensions(
  featureKey: FeatureKey,
  body?: { width?: number; height?: number; steps?: number }
) {
  const cfg = getServerImageConfig();
  const defaults =
    featureKey === "comic_4panel"
      ? { width: cfg.comicSize, height: cfg.comicSize, steps: cfg.maxSteps }
      : { width: cfg.imageWidth, height: cfg.imageHeight, steps: cfg.maxSteps };

  const width = clampRequestInt(body?.width, 256, 1024, defaults.width);
  const height = clampRequestInt(body?.height, 256, 1024, defaults.height);
  const steps = clampRequestInt(body?.steps, 8, 40, defaults.steps);

  return {
    width: Math.min(width, defaults.width),
    height: Math.min(height, defaults.height),
    steps: Math.min(steps, cfg.maxSteps),
  };
}

export function buildFinalPrompt(featureKey: FeatureKey, prompt: string) {
  const base = (prompt ?? "").trim();
  const globalStyle = [
    "Style: positive, calming, creative inspiration.",
    "Medium: graphite pencil sketch on paper, subtle shading, minimal lines, no color.",
    "Subject: nature, landscape, everyday objects, quiet daily scenes, sunlight, sky, plants, small details.",
    "Avoid: portrait, close-up face, realistic celebrity-like people, identifiable persons, text, watermark, logo.",
    "If people appear, keep them as tiny silhouettes from behind or distant figures, not the main focus.",
  ].join(" ");

  if (featureKey === "comic_4panel") {
    return `${base}\n\n${globalStyle}\n\n4 panel comic, 2x2 grid layout, consistent mood, clean pencil line art, korean webtoon paneling (but still pencil sketch)`;
  }
  return `${base}\n\n${globalStyle}`;
}
