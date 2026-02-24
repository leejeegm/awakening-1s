import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") ?? "50", 10)));
  const from = (page - 1) * limit;
  const nickname = searchParams.get("nickname")?.trim() || "";
  const contentType = searchParams.get("type")?.trim() || "";

  // 통계: content_type별 개수 (유형별 count 쿼리)
  const types = ["warm_message", "insight_card", "weekly_summary"];
  const typeCounts: Record<string, number> = {};
  await Promise.all(
    types.map(async (t) => {
      const { count } = await admin
        .from("ai_generated_content")
        .select("id", { count: "exact", head: true })
        .eq("content_type", t);
      typeCounts[t] = count ?? 0;
    })
  );

  let q = admin
    .from("ai_generated_content")
    .select("id, nickname, content_type, content, meta, created_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (nickname) q = q.eq("nickname", nickname);
  if (contentType) q = q.eq("content_type", contentType);

  const { data, error, count } = await q.range(from, from + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    items: data ?? [],
    total: count ?? 0,
    stats: typeCounts,
  });
}
