import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });
  const { id } = await params;
  let body: { purge_hold?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식 오류" }, { status: 400 });
  }
  if (typeof body.purge_hold !== "boolean") {
    return NextResponse.json({ error: "purge_hold(boolean) 필요" }, { status: 400 });
  }

  const { data: existing, error: selErr } = await admin
    .from("awakenings")
    .select("id, moderation_state")
    .eq("id", id)
    .maybeSingle();

  if (selErr || !existing) {
    return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
  }
  if ((existing as { moderation_state: string }).moderation_state !== "deleted") {
    return NextResponse.json({ error: "삭제 보관 상태가 아닙니다." }, { status: 400 });
  }

  const { error } = await admin
    .from("awakenings")
    .update({ purge_hold: body.purge_hold } as never)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, purge_hold: body.purge_hold });
}
