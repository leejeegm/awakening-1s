import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** 닉네임+비밀번호 검증 (타인 기록 조회·감응 닉네임·실험 종료 등에 사용) */
export async function POST(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "서버 설정 오류" }, { status: 503 });
  }
  let body: { nickname?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "요청 형식 오류" }, { status: 400 });
  }
  const nickname = (body.nickname ?? "").trim().slice(0, 20);
  const password = body.password ?? "";
  if (!nickname || !password) {
    return NextResponse.json({ ok: false, error: "닉네임과 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  const { data: row, error } = await admin
    .from("participant_keys")
    .select("password_hash")
    .eq("nickname", nickname)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: "확인에 실패했습니다." }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ ok: false, error: "해당 닉네임이 없거나 비밀번호가 일치하지 않습니다." }, { status: 401 });
  }
  const hash = sha256Hex(password);
  const keyRow = row as { password_hash?: string | null };
  if (!keyRow.password_hash || keyRow.password_hash !== hash) {
    return NextResponse.json({ ok: false, error: "비밀번호가 일치하지 않습니다." }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
