/** localStorage: 브라우저에 공동 닉네임 사용 중 상태 유지 */
export const SHARED_NICKNAME_STORAGE_KEY = "resonance_shared_nickname_v1";

export type RecordScope = "personal" | "shared";

export function normalizeNicknameKey(nickname: string): string {
  return (nickname ?? "").trim().slice(0, 20);
}

export function isSharedScopeRecord(
  recordScope: RecordScope | undefined,
  savedNickname: string,
  sharedNickname: string | null | undefined
): boolean {
  if (recordScope === "shared") return true;
  if (recordScope === "personal") return false;
  const shared = normalizeNicknameKey(sharedNickname ?? "");
  const saved = normalizeNicknameKey(savedNickname);
  return !!shared && saved.toLowerCase() === shared.toLowerCase();
}

export function readStoredSharedNickname(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(SHARED_NICKNAME_STORAGE_KEY)?.trim().slice(0, 20);
    return v || null;
  } catch {
    return null;
  }
}

export function writeStoredSharedNickname(nickname: string): void {
  if (typeof window === "undefined") return;
  const n = normalizeNicknameKey(nickname);
  if (!n) return;
  try {
    localStorage.setItem(SHARED_NICKNAME_STORAGE_KEY, n);
  } catch {
    // ignore
  }
}

export function clearStoredSharedNickname(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SHARED_NICKNAME_STORAGE_KEY);
  } catch {
    // ignore
  }
}
