import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyParticipantAuthHash } from "@/lib/participantAuth";
import { normalizeNickname } from "@/lib/entitlements";
import { getWeekRangeKST } from "@/lib/weekRange";
import {
  buildPremiumReportCtaState,
  buildPremiumReportEligibilityMessage,
  getRecentSundayKeysKST,
  PREMIUM_REPORT_REQUIRED_DAYS_PER_WEEK,
  PREMIUM_REPORT_REQUIRED_WEEKS,
  type PremiumReportEligibilityWeek,
} from "@/lib/premiumReport";

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

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const daySet = new Set(((data ?? []) as { created_at: string }[]).map((row) => formatKstDay(row.created_at)));
    weeklyDayCounts.push({
      week,
      distinctDays: daySet.size,
      qualifies: daySet.size >= PREMIUM_REPORT_REQUIRED_DAYS_PER_WEEK,
    });
  }

  const qualifies =
    weeklyDayCounts.length === PREMIUM_REPORT_REQUIRED_WEEKS &&
    weeklyDayCounts.every((row) => row.qualifies);
  const consecutiveWeeks = weeklyDayCounts.filter((row) => row.qualifies).length;
  const qualifiesFromWeek = qualifies ? weeklyDayCounts[0]?.week ?? null : null;

  await admin.from("premium_report_eligibility_snapshots").upsert({
    nickname,
    qualifies,
    consecutive_weeks: consecutiveWeeks,
    qualifies_from_week: qualifiesFromWeek,
    evaluated_at: new Date().toISOString(),
    weekly_day_counts_json: weeklyDayCounts,
    meta_json: { checkedWeeks: weeks.length },
  } as never);

  return NextResponse.json({
    qualifies,
    consecutiveWeeks,
    qualifiesFromWeek,
    ctaState: buildPremiumReportCtaState(qualifies),
    message: buildPremiumReportEligibilityMessage(qualifies),
    weeklyDayCounts,
  });
}
