/** sessionStorage: 닉네임별 참가자 인증 해시(탭 단위, 로그아웃 시 삭제) */
export const PARTICIPANT_AUTH_HASH_PREFIX = "participant_auth_hash_v1";

export function participantAuthStorageKey(nickname: string): string {
  return `${PARTICIPANT_AUTH_HASH_PREFIX}:${nickname.trim()}`;
}

export function getParticipantAuthHash(nickname: string): string {
  if (typeof window === "undefined") return "";
  const nick = nickname.trim();
  if (!nick) return "";
  try {
    return sessionStorage.getItem(participantAuthStorageKey(nick)) ?? "";
  } catch {
    return "";
  }
}

export function setParticipantAuthHash(nickname: string, authHash: string): void {
  if (typeof window === "undefined") return;
  const nick = nickname.trim();
  const hash = authHash.trim();
  if (!nick || !hash) return;
  try {
    sessionStorage.setItem(participantAuthStorageKey(nick), hash);
  } catch {
    /* ignore */
  }
}

export function clearParticipantAuthHash(nickname: string): void {
  if (typeof window === "undefined") return;
  const nick = nickname.trim();
  if (!nick) return;
  try {
    sessionStorage.removeItem(participantAuthStorageKey(nick));
  } catch {
    /* ignore */
  }
}
