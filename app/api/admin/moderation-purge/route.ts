import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getModerationQuarantineDays } from "@/lib/moderationQuarantine";

type Body = { days?: number; ids?: string[] };

export async function POST(request: NextRequest) {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }

  const defaultDays = getModerationQuarantineDays();
  const days =
    typeof body.days === "number" && Number.isFinite(body.days) && body.days >= 0 ? body.days : defaultDays;

  const cutoffIso = new Date(Date.now() - days * 86400000).toISOString();

  let q = admin
    .from("awakenings")
    .select("id, note")
    .eq("moderation_state", "deleted")
    .eq("purge_hold", false)
    .lte("deleted_at", cutoffIso);

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    q = q.in("id", body.ids.slice(0, 200));
  }

  const { data: victims, error: listErr } = await q;

  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const rows = (victims ?? []) as { id: string; note: string }[];
  let purged = 0;

  for (const row of rows) {
    const { error: delErr } = await admin.from("awakenings").delete().eq("id", row.id);
    if (delErr) continue;
    await admin.from("admin_actions").insert({
      action: "delete",
      awakening_id: row.id,
      old_note: row.note ?? null,
      new_note: null,
      reason: `삭제 보관 폐기(보관 ${days}일 경과 또는 지정 목록).`,
    } as never);
    purged += 1;
  }

  return NextResponse.json({
    ok: true,
    requestedDays: days,
    defaultQuarantineDays: defaultDays,
    purgedCount: purged,
    candidateCount: rows.length,
  });
}
