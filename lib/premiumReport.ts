import { getThisWeekSundayKST } from "@/lib/weekRange";

export const PREMIUM_REPORT_PRODUCT_CODE = "jakkae-premium-weekly";
export const PREMIUM_REPORT_REQUIRED_WEEKS = 4;
export const PREMIUM_REPORT_REQUIRED_DAYS_PER_WEEK = 3;

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

export function buildPremiumReportEligibilityMessage(qualifies: boolean) {
  return qualifies
    ? "유료 보고서 신청이 가능합니다."
    : `매주 ${PREMIUM_REPORT_REQUIRED_DAYS_PER_WEEK}일 이상 ${PREMIUM_REPORT_REQUIRED_WEEKS}주 연속 기록 시도해주세요`;
}

export function buildPremiumReportCtaState(qualifies: boolean): "enabled" | "locked" {
  return qualifies ? "enabled" : "locked";
}
