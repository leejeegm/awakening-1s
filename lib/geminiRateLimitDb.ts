import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function isGeminiRateLimitDbEnabled(): boolean {
  const v = (process.env.GEMINI_RATE_LIMIT_USE_DB ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function windowMs() {
  const n = parseInt(process.env.GEMINI_RATE_LIMIT_WINDOW_MS ?? String(60 * 60 * 1000), 10);
  return Number.isFinite(n) && n >= 60_000 ? n : 60 * 60 * 1000;
}

function maxPerWindow() {
  const n = parseInt(process.env.GEMINI_RATE_LIMIT_MAX_PER_KEY ?? "80", 10);
  return Number.isFinite(n) && n >= 1 ? n : 80;
}

/** DB 기반 윈도우 시작(UTC 기준 정렬된 버킷) */
function windowStartIso(): string {
  const w = windowMs();
  const t = Math.floor(Date.now() / w) * w;
  return new Date(t).toISOString();
}

/**
 * Supabase 원자적 카운터로 한도 검사.
 * @returns `true` 허용, `false` 한도 초과, `null` DB 미사용·오류(메모리 폴백)
 */
export async function tryConsumeGeminiRateDb(rateKey: string): Promise<boolean | null> {
  if (!isGeminiRateLimitDbEnabled()) return null;
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const key = rateKey.slice(0, 200);
  const { data, error } = await admin.rpc("try_consume_gemini_rate", {
    p_rate_key: key,
    p_window_start: windowStartIso(),
    p_max: maxPerWindow(),
  });

  if (error) {
    console.warn("[gemini-rate-db]", error.message);
    return null;
  }
  return data === true;
}
