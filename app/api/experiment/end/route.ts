import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** 참여자(닉네임+비밀번호) 검증 후 실험 종료 처리. 참여자 한 명이라도 선택하면 실험실이 사라짐. */
export async function POST(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });
  }
  let body: { nickname?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식 오류" }, { status: 400 });
  }
  const nickname = (body.nickname ?? "").trim().slice(0, 20);
  const password = body.password ?? "";
  if (!nickname || !password) {
    return NextResponse.json({ error: "닉네임과 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  const { data: row, error: keyError } = await admin
    .from("participant_keys")
    .select("password_hash")
    .eq("nickname", nickname)
    .maybeSingle();

  if (keyError || !row) {
    return NextResponse.json({ error: "해당 닉네임이 없거나 비밀번호가 일치하지 않습니다." }, { status: 401 });
  }
  const keyRow = row as { password_hash?: string | null };
  if (!keyRow.password_hash || keyRow.password_hash !== sha256Hex(password)) {
    return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 401 });
  }

  const { error: updateError } = await admin
    .from("experiment_control")
    .update({
      ended: true,
      ended_at: new Date().toISOString(),
      ended_by: nickname,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", 1);

  if (updateError) {
    return NextResponse.json({ error: "실험 종료 처리에 실패했습니다." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
