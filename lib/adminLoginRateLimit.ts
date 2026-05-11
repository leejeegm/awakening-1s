/**
 * 관리자 로그인 실패 레이트 리밋 (인스턴스 메모리, 서버리스에서는 베스트 에포트).
 * 환경 변수로 조정 가능.
 */

type Entry = { fails: number; windowStart: number; lockedUntil: number };

const store = new Map<string, Entry>();

function maxFails() {
  const n = parseInt(process.env.ADMIN_LOGIN_MAX_FAILS ?? "12", 10);
  return Number.isFinite(n) && n >= 3 ? n : 12;
}

function windowMs() {
  const n = parseInt(process.env.ADMIN_LOGIN_FAIL_WINDOW_MS ?? String(15 * 60 * 1000), 10);
  return Number.isFinite(n) && n >= 60_000 ? n : 15 * 60 * 1000;
}

function lockoutMs() {
  const n = parseInt(process.env.ADMIN_LOGIN_LOCKOUT_MS ?? String(15 * 60 * 1000), 10);
  return Number.isFinite(n) && n >= 60_000 ? n : 15 * 60 * 1000;
}

export function isAdminLoginLocked(ip: string): boolean {
  const now = Date.now();
  const e = store.get(ip);
  if (!e) return false;
  if (e.lockedUntil > now) return true;
  if (now - e.windowStart > windowMs()) {
    store.delete(ip);
    return false;
  }
  return false;
}

export function recordAdminLoginFailure(ip: string): void {
  const now = Date.now();
  const w = windowMs();
  let e = store.get(ip);
  if (!e || now - e.windowStart > w) {
    e = { fails: 0, windowStart: now, lockedUntil: 0 };
  }
  e.fails += 1;
  if (e.fails >= maxFails()) {
    e.lockedUntil = now + lockoutMs();
  }
  store.set(ip, e);
}

export function clearAdminLoginFailures(ip: string): void {
  store.delete(ip);
}
