import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyParticipantAuthHash } from "@/lib/participantAuth";
import { normalizeNickname } from "@/lib/entitlements";
import { computePremiumReportEligibility } from "@/lib/premiumReportEligibility";
import { getRecentSundayKeysKST } from "@/lib/premiumReport";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawNickname = (searchParams.get("nickname") ?? "").trim().slice(0, 20);
  const nickname = normalizeNickname(rawNickname);
  const authHash = (searchParams.get("authHash") ?? "").trim();

  if (!nickname || !rawNickname) {
    return NextResponse.json({ error: "닉네임이 필요합니다." }, { status: 400 });
  }
  if (!authHash) {
    return NextResponse.json({ error: "인증이 필요합니다.", requiresAuth: true }, { status: 401 });
  }

  const ok = await verifyParticipantAuthHash(rawNickname, authHash);
  if (!ok) {
    return NextResponse.json({ error: "인증에 실패했습니다.", requiresAuth: true }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "DB 연결을 사용할 수 없습니다." }, { status: 503 });
  }

  const result = await computePremiumReportEligibility(admin, rawNickname);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const { evaluation } = result;

  await admin.from("premium_report_eligibility_snapshots").upsert({
    nickname,
    qualifies: evaluation.qualifies,
    consecutive_weeks: evaluation.consecutiveWeeks,
    qualifies_from_week: evaluation.qualifiesFromWeek,
    evaluated_at: new Date().toISOString(),
    weekly_day_counts_json: evaluation.weeklyDayCounts,
    meta_json: {
      checkedWeeks: getRecentSundayKeysKST().length,
      qualifiesWeekly: evaluation.qualifiesWeekly,
      qualifiesRolling: evaluation.qualifiesRolling,
      rolling: evaluation.rolling,
    },
  } as never);

  return NextResponse.json({
    qualifies: evaluation.qualifies,
    qualifiesWeekly: evaluation.qualifiesWeekly,
    qualifiesRolling: evaluation.qualifiesRolling,
    consecutiveWeeks: evaluation.consecutiveWeeks,
    qualifiesFromWeek: evaluation.qualifiesFromWeek,
    ctaState: evaluation.ctaState,
    message: evaluation.message,
    weeklyDayCounts: evaluation.weeklyDayCounts,
    rolling: evaluation.rolling,
  });
}
