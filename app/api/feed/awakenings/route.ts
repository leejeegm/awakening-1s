import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * 실험 데이터 타임라인(전체/내)용 피드.
 * 기존 UX(실시간 목록/누적 비교)를 유지하기 위해 서버에서 읽어 내려줍니다.
 *
 * 기본: 최근 60개 (moderation_state='ok')
 * nickname 제공 시: 해당 닉네임 최근 100개
 */
export async function GET(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ items: [] }, { status: 200 });

  const { searchParams } = new URL(request.url);
  const nickname = (searchParams.get("nickname") ?? "").trim().slice(0, 20);
  const limit = nickname ? 100 : 60;

  let q = admin
    .from("awakenings")
    .select("id, created_at, nickname, note, duration_type")
    .eq("moderation_state", "ok")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (nickname) q = q.eq("nickname", nickname);

  const { data, error } = await q;
  if (error) return NextResponse.json({ items: [] }, { status: 200 });
  return NextResponse.json({ items: data ?? [] }, { status: 200 });
}

