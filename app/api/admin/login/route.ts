import { NextRequest, NextResponse } from "next/server";
import { verifyAdminPassword, setAdminCookie, isAdminConfigured } from "@/lib/adminAuth";

export async function POST(request: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "관리자 기능이 설정되지 않았습니다. ADMIN_SECRET, SUPABASE_SERVICE_ROLE_KEY를 확인하세요." },
      { status: 503 }
    );
  }
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const password = body.password ?? "";
  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  await setAdminCookie();
  return NextResponse.json({ ok: true });
}
