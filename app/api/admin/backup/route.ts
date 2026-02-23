import { NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const MAX_RECORDS = 10000;

function tokenize(text: string): string[] {
  return text
    .replace(/[\s.,!?;:'"()[\]{}\-\u3000-\u303f\uff00-\uffef]+/g, " ")
    .split(" ")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 2);
}

function buildKeywordSummary(notes: string[]): { keyword: string; count: number }[] {
  const map = new Map<string, number>();
  for (const note of notes) {
    for (const word of tokenize(note)) {
      map.set(word, (map.get(word) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([keyword, count]) => ({ keyword, count }));
}

export async function GET() {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });
  }

  const [recordsRes, reactionsRes] = await Promise.all([
    admin
      .from("awakenings")
      .select("id, created_at, nickname, note, duration_type")
      .order("created_at", { ascending: false })
      .limit(MAX_RECORDS),
    admin.from("reactions").select("id, awakening_id, reaction_type, created_at").limit(MAX_RECORDS * 2),
  ]);

  if (recordsRes.error) {
    return NextResponse.json({ error: recordsRes.error.message }, { status: 500 });
  }
  if (reactionsRes.error) {
    return NextResponse.json({ error: reactionsRes.error.message }, { status: 500 });
  }

  const records = recordsRes.data ?? [];
  const reactions = reactionsRes.data ?? [];

  const notes = records.map((r) => (r as { note: string }).note).filter(Boolean);
  const keywordSummary = buildKeywordSummary(notes);

  const payload = {
    exportedAt: new Date().toISOString(),
    summary: {
      recordsCount: records.length,
      reactionsCount: reactions.length,
      keywordTypes: keywordSummary.length,
    },
    records,
    reactions,
    keywordSummary,
  };

  return NextResponse.json(payload);
}
