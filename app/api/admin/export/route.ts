import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const MAX = 50000;

function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function tokenize(text: string): string[] {
  return text
    .replace(/[\s.,!?;:'"()[\]{}\-\u3000-\u303f\uff00-\uffef]+/g, " ")
    .split(" ")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 2);
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const dataType = searchParams.get("dataType") ?? "all"; // records | reactions | keywords | all
  const from = searchParams.get("from") ?? ""; // YYYY-MM-DD
  const to = searchParams.get("to") ?? ""; // YYYY-MM-DD
  const nickname = searchParams.get("nickname")?.trim() ?? "";
  const format = (searchParams.get("format") ?? "csv").toLowerCase(); // csv | xls

  const fromDate = from ? `${from}T00:00:00.000Z` : null;
  const toDate = to ? `${to}T23:59:59.999Z` : null;

  let records: { id: string; created_at: string; nickname: string; note: string; duration_type?: string }[] = [];
  let reactions: { id: string; awakening_id: string; reaction_type: string; created_at: string }[] = [];

  if (dataType === "records" || dataType === "all") {
    let q = admin.from("awakenings").select("id, created_at, nickname, note, duration_type").order("created_at", { ascending: false }).limit(MAX);
    if (fromDate) q = q.gte("created_at", fromDate);
    if (toDate) q = q.lte("created_at", toDate);
    if (nickname) q = q.eq("nickname", nickname);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    records = (data ?? []) as typeof records;
  }

  if (dataType === "reactions" || dataType === "all") {
    let q = admin.from("reactions").select("id, awakening_id, reaction_type, created_at").order("created_at", { ascending: false }).limit(MAX);
    if (fromDate) q = q.gte("created_at", fromDate);
    if (toDate) q = q.lte("created_at", toDate);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    reactions = (data ?? []) as typeof reactions;
  }

  const notes = records.map((r) => r.note).filter(Boolean);
  const keywordMap = new Map<string, number>();
  for (const note of notes) {
    for (const w of tokenize(note)) {
      keywordMap.set(w, (keywordMap.get(w) ?? 0) + 1);
    }
  }
  const keywordSummary = Array.from(keywordMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([keyword, count]) => ({ keyword, count }));

  const lines: string[] = [];
  const ext = format === "xls" ? "xls" : "csv";
  const mime = format === "xls" ? "application/vnd.ms-excel" : "text/csv; charset=utf-8";

  if (dataType === "records" || dataType === "all") {
    lines.push("id,created_at,nickname,note,duration_type");
    for (const r of records) {
      lines.push([r.id, r.created_at, escapeCsvCell(r.nickname), escapeCsvCell(r.note), r.duration_type ?? ""].join(","));
    }
    if (dataType === "all") lines.push("");
  }
  if (dataType === "reactions" || dataType === "all") {
    lines.push("id,awakening_id,reaction_type,created_at");
    for (const r of reactions) {
      lines.push([r.id, r.awakening_id, r.reaction_type, r.created_at].join(","));
    }
    if (dataType === "all") lines.push("");
  }
  if (dataType === "keywords" || dataType === "all") {
    lines.push("keyword,count");
    for (const k of keywordSummary) {
      lines.push([escapeCsvCell(k.keyword), k.count].join(","));
    }
  }

  const bom = "\uFEFF";
  const body = bom + lines.join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="awakening-export-${dataType}-${from || "all"}-${to || "all"}${nickname ? `-${nickname}` : ""}.${ext}"`,
    },
  });
}
