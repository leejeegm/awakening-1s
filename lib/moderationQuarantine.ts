/** 삭제(보관) 후 완전 폐기까지 최소 보관 일수. 이후 관리자 폐기 API로만 삭제 가능(유보 제외). */
export function getModerationQuarantineDays(): number {
  const raw = process.env.MODERATION_QUARANTINE_DAYS;
  const n = raw ? parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n >= 0) return n;
  return 30;
}
