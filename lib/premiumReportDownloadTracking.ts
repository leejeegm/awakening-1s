const STORAGE_PREFIX = "premium_report_download_count_v1";

export function premiumReportDownloadCountKey(nickname: string, requestId: string): string {
  return `${STORAGE_PREFIX}:${nickname.trim()}:${requestId}`;
}

export function getPremiumReportDownloadCount(nickname: string, requestId: string): number {
  if (typeof window === "undefined") return 0;
  const nick = nickname.trim();
  const id = requestId.trim();
  if (!nick || !id) return 0;
  try {
    const raw = localStorage.getItem(premiumReportDownloadCountKey(nick, id));
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function incrementPremiumReportDownloadCount(nickname: string, requestId: string): number {
  const next = getPremiumReportDownloadCount(nickname, requestId) + 1;
  if (typeof window === "undefined") return next;
  try {
    localStorage.setItem(premiumReportDownloadCountKey(nickname, requestId), String(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function formatPremiumReportDownloadCountLabel(count: number): string {
  const n = Math.max(0, Math.floor(count));
  return `(${String(n).padStart(2, "0")}회 완료)`;
}
