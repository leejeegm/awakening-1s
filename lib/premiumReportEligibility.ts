import type { SupabaseClient } from "@supabase/supabase-js";
import { getWeekRangeKST } from "@/lib/weekRange";
import {
  PREMIUM_REPORT_REQUIRED_DAYS_PER_WEEK,
  PREMIUM_REPORT_REQUIRED_WEEKS,
  PREMIUM_REPORT_ROLLING_DAYS,
  PREMIUM_REPORT_ROLLING_MIN_RECORDS,
  buildPremiumReportCtaState,
  buildPremiumReportEligibilityMessage,
  getRecentSundayKeysKST,
  type PremiumReportEligibilityWeek,
} from "@/lib/premiumReport";

export type PremiumReportRollingEligibility = {
  windowDays: number;
  minRecords: number;
  recordCount: number;
  windowFrom: string;
  windowTo: string;
  qualifies: boolean;
};

export type PremiumReportEligibilityEvaluation = {
  qualifiesWeekly: boolean;
  qualifiesRolling: boolean;
  qualifies: boolean;
  consecutiveWeeks: number;
  qualifiesFromWeek: string | null;
  weeklyDayCounts: PremiumReportEligibilityWeek[];
  rolling: PremiumReportRollingEligibility;
  message: string;
  ctaState: "enabled" | "locked";
};

function formatKstDay(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(iso))
    .replace(/\//g, "-");
}

/** 조회 시점(KST) 기준 최근 28일 구간 */
export function getRolling28DaysRangeKST(now = new Date()): { from: string; to: string; label: string } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const toLabel = formatter.format(now);
  const toEnd = new Date(`${toLabel}T23:59:59.999+09:00`);
  const fromStart = new Date(`${toLabel}T00:00:00+09:00`);
  fromStart.setDate(fromStart.getDate() - (PREMIUM_REPORT_ROLLING_DAYS - 1));
  const fromLabel = formatter.format(fromStart);
  return {
    from: fromStart.toISOString(),
    to: toEnd.toISOString(),
    label: `${fromLabel} ~ ${toLabel}`,
  };
}

export function evaluateWeeklyEligibility(weeklyDayCounts: PremiumReportEligibilityWeek[]) {
  const qualifiesWeekly =
    weeklyDayCounts.length === PREMIUM_REPORT_REQUIRED_WEEKS &&
    weeklyDayCounts.every((row) => row.qualifies);

  let consecutiveWeeks = 0;
  for (let i = weeklyDayCounts.length - 1; i >= 0; i--) {
    if (!weeklyDayCounts[i]?.qualifies) break;
    consecutiveWeeks += 1;
  }
  const qualifiesFromWeek =
    consecutiveWeeks > 0
      ? weeklyDayCounts[weeklyDayCounts.length - consecutiveWeeks]?.week ?? null
      : null;

  return { qualifiesWeekly, consecutiveWeeks, qualifiesFromWeek };
}

export function evaluateRollingEligibility(recordCount: number, window: { from: string; to: string }) {
  const qualifies = recordCount >= PREMIUM_REPORT_ROLLING_MIN_RECORDS;
  return {
    windowDays: PREMIUM_REPORT_ROLLING_DAYS,
    minRecords: PREMIUM_REPORT_ROLLING_MIN_RECORDS,
    recordCount,
    windowFrom: window.from,
    windowTo: window.to,
    qualifies,
  } satisfies PremiumReportRollingEligibility;
}

export function mergePremiumEligibility(
  weeklyDayCounts: PremiumReportEligibilityWeek[],
  rolling: PremiumReportRollingEligibility
): PremiumReportEligibilityEvaluation {
  const { qualifiesWeekly, consecutiveWeeks, qualifiesFromWeek } = evaluateWeeklyEligibility(weeklyDayCounts);
  const qualifiesRolling = rolling.qualifies;
  const qualifies = qualifiesWeekly || qualifiesRolling;

  return {
    qualifiesWeekly,
    qualifiesRolling,
    qualifies,
    consecutiveWeeks,
    qualifiesFromWeek,
    weeklyDayCounts,
    rolling,
    message: buildPremiumReportEligibilityMessage({
      qualifies,
      qualifiesWeekly,
      qualifiesRolling,
      rolling,
    }),
    ctaState: buildPremiumReportCtaState(qualifies),
  };
}

/** 닉네임 기준 주별·28일 자격 계산 (서버 전용) */
export async function computePremiumReportEligibility(
  admin: SupabaseClient,
  rawNickname: string
): Promise<{ ok: true; evaluation: PremiumReportEligibilityEvaluation } | { ok: false; error: string }> {
  const weeks = getRecentSundayKeysKST(PREMIUM_REPORT_REQUIRED_WEEKS);
  const weeklyDayCounts: PremiumReportEligibilityWeek[] = [];

  for (const week of weeks) {
    const { from, to } = getWeekRangeKST(week);
    const { data, error } = await admin
      .from("awakenings")
      .select("created_at")
      .eq("nickname", rawNickname)
      .gte("created_at", from)
      .lte("created_at", to);

    if (error) return { ok: false, error: error.message };

    const daySet = new Set(((data ?? []) as { created_at: string }[]).map((row) => formatKstDay(row.created_at)));
    weeklyDayCounts.push({
      week,
      distinctDays: daySet.size,
      qualifies: daySet.size >= PREMIUM_REPORT_REQUIRED_DAYS_PER_WEEK,
    });
  }

  const rollingWindow = getRolling28DaysRangeKST();
  const { count, error: countError } = await admin
    .from("awakenings")
    .select("id", { count: "exact", head: true })
    .eq("nickname", rawNickname)
    .gte("created_at", rollingWindow.from)
    .lte("created_at", rollingWindow.to);

  if (countError) return { ok: false, error: countError.message };

  const rolling = evaluateRollingEligibility(count ?? 0, rollingWindow);
  const evaluation = mergePremiumEligibility(weeklyDayCounts, rolling);

  return { ok: true, evaluation };
}
