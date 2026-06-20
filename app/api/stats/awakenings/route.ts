import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * 누적 집계(전체/닉네임별)용.
 * - totalRecords: moderation_state='ok' 전체 기록 수 (나만보기+공개, 건수만)
 * - myRecordCount: nickname 제공 시 해당 닉네임 전체 기록 건수 (나만보기+공개, 건수만)
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

  /** 참여자 전체 누적: 검수 통과 기록 전체(나만보기+공개, 건수만·내용 미노출) */
  const totalReq = admin
    .from("awakenings")
    .select("*", { count: "exact", head: true })
    .eq("moderation_state", "ok");

  let myReq = null as null | ReturnType<typeof admin.from>;
  if (nickname) {
    myReq = admin
      .from("awakenings")
      .select("*", { count: "exact", head: true })
      .eq("moderation_state", "ok")
      .eq("nickname", nickname);
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

