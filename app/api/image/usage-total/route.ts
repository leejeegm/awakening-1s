import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyParticipantAuthHash } from "@/lib/participantAuth";
import { normalizeNickname } from "@/lib/entitlements";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawNick = (searchParams.get("nickname") ?? "").trim().slice(0, 20);
  const nickname = normalizeNickname(rawNick);
  const authHash = (searchParams.get("authHash") ?? "").trim();

  if (!rawNick || !nickname) {
    return NextResponse.json({ ok: false, error: "닉네임이 필요합니다." }, { status: 400 });
  }
  if (!authHash) {
    return NextResponse.json({ ok: false, error: "인증이 필요합니다.", requiresAuth: true }, { status: 401 });
  }

  const authed = await verifyParticipantAuthHash(rawNick, authHash);
  if (!authed) {
    return NextResponse.json({ ok: false, error: "인증에 실패했습니다.", requiresAuth: true }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "서버 설정 오류" }, { status: 503 });
  }

  const res = await admin
    .from("image_generation_usage")
    .select("id", { count: "exact", head: true })
    .eq("nickname", nickname);

  if (res.error) {
    return NextResponse.json({ ok: false, error: "사용량 조회에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, usedTotal: res.count ?? 0 });
}

