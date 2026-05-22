import { NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeNickname } from "@/lib/entitlements";

export async function GET() {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });
  }

  const { data: requests, error: reqError } = await admin
    .from("premium_report_requests")
    .select("id, nickname, status, payment_status, requested_at, updated_at")
    .order("requested_at", { ascending: false })
    .limit(200);

  if (reqError) {
    return NextResponse.json({ error: reqError.message }, { status: 500 });
  }

  const nicknames = Array.from(
    new Set((requests ?? []).map((row) => normalizeNickname((row as { nickname: string }).nickname)).filter(Boolean))
  );

  const { data: snapshots } =
    nicknames.length > 0
      ? await admin
          .from("premium_report_eligibility_snapshots")
          .select("nickname, qualifies, evaluated_at, meta_json")
          .in("nickname", nicknames)
      : { data: [] };

  const snapshotByNick = new Map(
    (snapshots ?? []).map((row) => [
      (row as { nickname: string }).nickname,
      row as { qualifies: boolean; evaluated_at: string; meta_json: unknown },
    ])
  );

  const items = (requests ?? []).map((row) => {
    const r = row as {
      id: string;
      nickname: string;
      status: string;
      payment_status: string;
      requested_at: string;
      updated_at: string;
    };
    const nickKey = normalizeNickname(r.nickname);
    const snap = snapshotByNick.get(nickKey);
    const meta = snap?.meta_json as { qualifiesWeekly?: boolean; qualifiesRolling?: boolean } | null;
    return {
      requestId: r.id,
      nickname: r.nickname,
      status: r.status,
      payment_status: r.payment_status,
      requested_at: r.requested_at,
      updated_at: r.updated_at,
      qualifies: snap?.qualifies ?? null,
      qualifiesWeekly: meta?.qualifiesWeekly ?? null,
      qualifiesRolling: meta?.qualifiesRolling ?? null,
      eligibilityEvaluatedAt: snap?.evaluated_at ?? null,
    };
  });

  return NextResponse.json({ items });
}
