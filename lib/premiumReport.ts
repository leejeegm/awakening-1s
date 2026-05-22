import { getThisWeekSundayKST } from "@/lib/weekRange";

export const PREMIUM_REPORT_PRODUCT_CODE = "jakkae-premium-weekly";
export const PREMIUM_REPORT_REQUIRED_WEEKS = 4;
export const PREMIUM_REPORT_REQUIRED_DAYS_PER_WEEK = 3;
/** 관리자 테스트·완화 기준: 조회 시점 기준 최근 28일(4주) 총 기록 횟수 */
export const PREMIUM_REPORT_ROLLING_DAYS = 28;
export const PREMIUM_REPORT_ROLLING_MIN_RECORDS = 12;

export type PremiumReportRequestStatus =
  | "requested"
  | "paid_pending"
  | "approved"
  | "in_progress"
  | "ready"
  | "rejected"
  | "expired";

export type PremiumReportPaymentStatus =
  | "unpaid"
  | "pending_manual_check"
  | "confirmed"
  | "failed"
  | "refunded";

export type PremiumReportPdfStatus = "draft" | "generating" | "ready" | "failed";

export type PremiumReportAssetType =
  | "chart_image"
  | "attachment_pdf"
  | "attachment_image"
  | "final_pdf"
  | "analysis_note";

export type PremiumReportEligibilityWeek = {
  week: string;
  distinctDays: number;
  qualifies: boolean;
};

export function getRecentSundayKeysKST(count = PREMIUM_REPORT_REQUIRED_WEEKS): string[] {
  const currentSunday = getThisWeekSundayKST();
  const base = new Date(`${currentSunday}T12:00:00+09:00`);
  const weeks: string[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - i * 7);
    weeks.push(d.toISOString().slice(0, 10));
  }

  return weeks;
}

export function buildPremiumReportEligibilityMessage(args: {
  qualifies: boolean;
  qualifiesWeekly?: boolean;
  qualifiesRolling?: boolean;
  rolling?: { recordCount: number; minRecords: number; windowDays: number };
}) {
  const { qualifies, qualifiesWeekly, qualifiesRolling, rolling } = args;
  if (!qualifies) {
    const rollingHint = rolling
      ? ` (또는 최근 ${rolling.windowDays}일 ${rolling.minRecords}회 이상 기록 — 현재 ${rolling.recordCount}회)`
      : "";
    return `매주 ${PREMIUM_REPORT_REQUIRED_DAYS_PER_WEEK}일 이상 ${PREMIUM_REPORT_REQUIRED_WEEKS}주 연속 기록 시도해주세요${rollingHint}`;
  }
  if (qualifiesWeekly) {
    return "유료 보고서 신청이 가능합니다. (주별 3일×4주 기준 충족)";
  }
  if (qualifiesRolling && rolling) {
    return `유료 보고서 신청이 가능합니다. (최근 ${rolling.windowDays}일 기록 ${rolling.recordCount}회 — 테스트·완화 기준 ${rolling.minRecords}회 이상)`;
  }
  return "유료 보고서 신청이 가능합니다.";
}

export function buildPremiumReportCtaState(qualifies: boolean): "enabled" | "locked" {
  return qualifies ? "enabled" : "locked";
}
