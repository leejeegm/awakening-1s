import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * 누적 집계(전체/닉네임별)용.
 * - totalRecords: moderation_state='ok' 전체 기록 수
 * - myRecordCount: nickname 제공 시 해당 닉네임 기록 수
 *
 * 주의: 내용(note)은 반환하지 않음.
 */
export async function GET(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ totalRecords: null, myRecordCount: null }, { status: 200 });
  }

  const { searchParams } = new URL(request.url);
  const nickname = (searchParams.get("nickname") ?? "").trim().slice(0, 20);
  const authHash = (searchParams.get("authHash") ?? "").trim().toLowerCase();

  /** 참여자 전체 누적: 공개·검수 통과 기록만 (익명 집계) */
  const totalReq = admin
    .from("awakenings")
    .select("*", { count: "exact", head: true })
    .eq("moderation_state", "ok")
    .eq("is_public", true);

  let myReq = null as null | ReturnType<typeof admin.from>;
  if (nickname) {
    let authOk = false;
    if (authHash) {
      const { data: keyRow } = await admin
        .from("participant_keys")
        .select("password_hash")
        .eq("nickname", nickname)
        .maybeSingle() as { data: { password_hash: string } | null };
      authOk = !!keyRow?.password_hash && keyRow.password_hash === authHash;
    }

    let q = admin
      .from("awakenings")
      .select("*", { count: "exact", head: true })
      .eq("moderation_state", "ok")
      .eq("nickname", nickname);
    if (!authOk) q = q.eq("is_public", true);
    myReq = q;
  }

  const [{ count: totalCount }, myRes] = await Promise.all([
    totalReq,
    myReq ?? Promise.resolve({ count: null }),
  ]);

  const myCount = (myRes as { count: number | null }).count ?? null;
  return NextResponse.json(
    {
      totalRecords: typeof totalCount === "number" ? totalCount : null,
      myRecordCount: nickname && typeof myCount === "number" ? myCount : null,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}

