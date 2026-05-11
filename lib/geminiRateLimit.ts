/**
 * Gemini 호출 상한 (인스턴스 메모리, 서버리스에서는 베스트 에포트).
 * 무료 한도·악용 완화용 — 키는 닉네임·IP 등 호출부에서 넘김.
 */

type Bucket = { windowStart: number; count: number };

const store = new Map<string, Bucket>();

function windowMs() {
  const n = parseInt(process.env.GEMINI_RATE_LIMIT_WINDOW_MS ?? String(60 * 60 * 1000), 10);
  return Number.isFinite(n) && n >= 60_000 ? n : 60 * 60 * 1000;
}

function maxPerWindow() {
  const n = parseInt(process.env.GEMINI_RATE_LIMIT_MAX_PER_KEY ?? "80", 10);
  return Number.isFinite(n) && n >= 1 ? n : 80;
}

/** 한 윈도우 안에서 허용되면 true */
export function takeGeminiRateSlot(key: string): boolean {
  const k = key.slice(0, 120);
  const now = Date.now();
  const w = windowMs();
  const max = maxPerWindow();
  let b = store.get(k);
  if (!b || now - b.windowStart >= w) {
    store.set(k, { windowStart: now, count: 1 });
    return true;
  }
  if (b.count >= max) return false;
  b.count += 1;
  return true;
}
