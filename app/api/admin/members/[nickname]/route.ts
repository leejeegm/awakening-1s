import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/** 닉네임에 해당하는 회원의 password_hint만 수정 (비밀번호 해시는 노출/변경 없음) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ nickname: string }> }
) {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });
  }
  const { nickname } = await params;
  const decoded = decodeURIComponent(nickname);
  let body: { password_hint?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const hint =
    body.password_hint === null || body.password_hint === ""
      ? null
      : String(body.password_hint ?? "").trim().slice(0, 100);
  const { error } = await admin
    .from("participant_keys")
    .update({ password_hint: hint } as never)
    .eq("nickname", decoded);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
