import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeNickname } from "@/lib/entitlements";
import { computePremiumReportEligibility, getRolling28DaysRangeKST } from "@/lib/premiumReportEligibility";
import { getRecentSundayKeysKST, PREMIUM_REPORT_ROLLING_DAYS, PREMIUM_REPORT_ROLLING_MIN_RECORDS } from "@/lib/premiumReport";

export async function GET(request: NextRequest) {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const rawNickname = (searchParams.get("nickname") ?? "").trim().slice(0, 20);
  const nickname = normalizeNickname(rawNickname);

  if (!nickname || !rawNickname) {
    return NextResponse.json({ error: "닉네임을 입력하세요." }, { status: 400 });
  }

  const result = await computePremiumReportEligibility(admin, rawNickname);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const { evaluation } = result;
  const rollingLabel = getRolling28DaysRangeKST().label;

  await admin.from("premium_report_eligibility_snapshots").upsert({
    nickname,
    qualifies: evaluation.qualifies,
    consecutive_weeks: evaluation.consecutiveWeeks,
    qualifies_from_week: evaluation.qualifiesFromWeek,
    evaluated_at: new Date().toISOString(),
    weekly_day_counts_json: evaluation.weeklyDayCounts,
    meta_json: {
      source: "admin_check",
      qualifiesWeekly: evaluation.qualifiesWeekly,
      qualifiesRolling: evaluation.qualifiesRolling,
      rolling: evaluation.rolling,
    },
  } as never);

  const { data: keyRow } = await admin
    .from("participant_keys")
    .select("nickname, password_hint, created_at")
    .eq("nickname", rawNickname)
    .maybeSingle();

  const { data: requests } = await admin
    .from("premium_report_requests")
    .select("id, status, payment_status, downloadable, requested_at, updated_at")
    .eq("nickname", nickname)
    .order("requested_at", { ascending: false })
    .limit(5);

  return NextResponse.json({
    nickname: rawNickname,
    evaluatedAt: new Date().toISOString(),
    hasParticipantKey: !!keyRow,
    passwordHint: (keyRow as { password_hint?: string | null } | null)?.password_hint ?? null,
    criteria: {
      weekly: "매주 3일 이상 × 4주 연속",
      rollingTest: `최근 ${PREMIUM_REPORT_ROLLING_DAYS}일(${rollingLabel}) 총 기록 ${PREMIUM_REPORT_ROLLING_MIN_RECORDS}회 이상`,
    },
    qualifies: evaluation.qualifies,
    qualifiesWeekly: evaluation.qualifiesWeekly,
    qualifiesRolling: evaluation.qualifiesRolling,
    canApplyPremiumReport: evaluation.qualifies,
    message: evaluation.message,
    weeklyDayCounts: evaluation.weeklyDayCounts,
    rolling: evaluation.rolling,
    recentRequests: requests ?? [],
  });
}
