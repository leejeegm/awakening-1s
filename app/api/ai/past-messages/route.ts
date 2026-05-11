import { NextRequest, NextResponse } from "next/server";
import { toAiGeneratedContentType } from "@/lib/aiGeneratedContentTypes";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "DB 연결을 사용할 수 없습니다.", items: [] }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const nickname = searchParams.get("nickname")?.trim() ?? "";
  const type = searchParams.get("type")?.trim() || ""; // insight_card | warm_message | weekly_summary (빈 값이면 전체)
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));

  if (!nickname) {
    return NextResponse.json({ error: "nickname이 필요합니다.", items: [] }, { status: 400 });
  }

  const contentType = type ? toAiGeneratedContentType(type) : null;

  let q = admin
    .from("ai_generated_content")
    .select("id, content_type, content, meta, created_at")
    .eq("nickname", nickname)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (contentType) {
    q = q.eq("content_type", contentType);
  }

  const { data, error } = await q;

  if (error) {
    return NextResponse.json({ error: error.message, items: [] }, { status: 500 });
  }

  const items = (data ?? []).map((r: { id: string; content_type: string; content: string; meta: unknown; created_at: string }) => ({
    id: r.id,
    content_type: r.content_type,
    content: r.content,
    meta: r.meta,
    created_at: r.created_at,
  }));

  return NextResponse.json({ items });
}
