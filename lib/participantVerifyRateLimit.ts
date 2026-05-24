/**
 * 참가자 비밀번호 검증 레이트 리밋 (인스턴스 메모리, 서버리스 베스트 에포트).
 */

type Entry = { fails: number; windowStart: number; lockedUntil: number };

const store = new Map<string, Entry>();

function maxFails() {
  const n = parseInt(process.env.PARTICIPANT_VERIFY_MAX_FAILS ?? "8", 10);
  return Number.isFinite(n) && n >= 3 ? n : 8;
}

function windowMs() {
  const n = parseInt(process.env.PARTICIPANT_VERIFY_FAIL_WINDOW_MS ?? String(15 * 60 * 1000), 10);
  return Number.isFinite(n) && n >= 60_000 ? n : 15 * 60 * 1000;
}

function lockoutMs() {
  const n = parseInt(process.env.PARTICIPANT_VERIFY_LOCKOUT_MS ?? String(15 * 60 * 1000), 10);
  return Number.isFinite(n) && n >= 60_000 ? n : 15 * 60 * 1000;
}

function key(ip: string, nickname: string) {
  return `${ip}:${nickname.trim().toLowerCase()}`;
}

export function isParticipantVerifyLocked(ip: string, nickname: string): boolean {
  const now = Date.now();
  const e = store.get(key(ip, nickname));
  if (!e) return false;
  if (e.lockedUntil > now) return true;
  if (now - e.windowStart > windowMs()) {
    store.delete(key(ip, nickname));
    return false;
  }
  return false;
}

export function recordParticipantVerifyFailure(ip: string, nickname: string): void {
  const now = Date.now();
  const w = windowMs();
  const k = key(ip, nickname);
  let e = store.get(k);
  if (!e || now - e.windowStart > w) {
    e = { fails: 0, windowStart: now, lockedUntil: 0 };
  }
  e.fails += 1;
  if (e.fails >= maxFails()) {
    e.lockedUntil = now + lockoutMs();
  }
  store.set(k, e);
}

export function clearParticipantVerifyFailures(ip: string, nickname: string): void {
  store.delete(key(ip, nickname));
}
