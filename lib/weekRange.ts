/**
 * 주별 마지막날(일요일) 0시 기준 KST.
 * week = "YYYY-MM-DD" (일요일 날짜)
 * 반환: 해당 주의 월요일 00:00 KST ~ 일요일 23:59:59.999 KST 의 ISO 문자열 (쿼리용).
 */
export function getWeekRangeKST(weekSunday: string): { from: string; to: string; label: string } {
  const sun = new Date(weekSunday + "T00:00:00+09:00");
  const mon = new Date(sun);
  mon.setDate(mon.getDate() - 6);
  const toEnd = new Date(weekSunday + "T23:59:59.999+09:00");
  const from = mon.toISOString();
  const to = toEnd.toISOString();
  const label = `${formatYMDKST(mon)} ~ ${weekSunday}`;
  return { from, to, label };
}

function formatYMDKST(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(d)
    .replace(/\//g, "-");
}

/** 오늘(KST) 기준 이번 주 일요일 날짜 YYYY-MM-DD */
export function getThisWeekSundayKST(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const now = new Date();
  const todayStr = formatter.format(now);
  const endOfWeek = new Date(todayStr + "T12:00:00+09:00");
  const day = endOfWeek.getUTCDay();
  const addDays = day === 0 ? 0 : 7 - day;
  endOfWeek.setUTCDate(endOfWeek.getUTCDate() + addDays);
  const y = endOfWeek.getUTCFullYear();
  const m = String(endOfWeek.getUTCMonth() + 1).padStart(2, "0");
  const d = String(endOfWeek.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
