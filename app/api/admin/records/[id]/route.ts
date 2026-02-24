import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

async function getExisting(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  id: string
): Promise<{ note: string } | null> {
  const { data } = await admin.from("awakenings").select("note").eq("id", id).single();
  return data as { note: string } | null;
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });
  const { id } = await params;
  const existing = await getExisting(admin, id);
  const { error: delError } = await admin.from("awakenings").delete().eq("id", id);
  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }
  await admin.from("admin_actions").insert({
    action: "delete",
    awakening_id: id,
    old_note: existing?.note ?? null,
    new_note: null,
    reason: "미풍양속·욕설·비방·협박 등 사유로 삭제",
  } as never);
  return NextResponse.json({ ok: true });
}

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
  let body: { note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const newNote = typeof body.note === "string" ? body.note.trim().slice(0, 200) : "";
  if (!newNote) {
    return NextResponse.json({ error: "수정할 내용을 입력하세요." }, { status: 400 });
  }
  const existing = await getExisting(admin, id);
  const { error: updateError } = await admin
    .from("awakenings")
    .update({ note: newNote } as never)
    .eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  await admin.from("admin_actions").insert({
    action: "update",
    awakening_id: id,
    old_note: existing?.note ?? null,
    new_note: newNote,
    reason: "미풍양속·욕설·비방·협박 등 사유로 수정",
  } as never);
  return NextResponse.json({ ok: true });
}
