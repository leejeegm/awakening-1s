import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getWeekRangeKST } from "@/lib/weekRange";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

type RecordRow = { id: string; created_at: string; nickname: string; note: string; duration_type?: string };

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
    for (const w of tokenize(note)) {
      map.set(w, (map.get(w) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([keyword, count]) => ({ keyword, count }));
}

async function getSentimentSummary(notes: string[]): Promise<string> {
  if (!OPENAI_API_KEY || notes.length === 0) return "감정 분석을 위해 OPENAI_API_KEY가 필요합니다.";
  const text = notes.slice(0, 30).join("\n");
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "당신은 사용자의 자각 기록을 읽고 감정·동기를 한 문단으로 요약하는 도우미입니다. 한국어로 2~3문장 이내로 작성하세요.",
          },
          {
            role: "user",
            content: `다음은 한 주간의 자각 기록입니다. 전체적인 감정·동기·트렌드를 요약해 주세요.\n\n${text}`,
          },
        ],
        max_tokens: 300,
      }),
    });
    if (!res.ok) return "감정 분석 요청 실패";
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content?.trim();
    return content || "요약 없음";
  } catch {
    return "감정 분석 중 오류";
  }
}

export async function GET(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "DB 연결을 사용할 수 없습니다." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const nickname = searchParams.get("nickname")?.trim() ?? "";
  const week = searchParams.get("week") ?? ""; // YYYY-MM-DD (일요일)
  const download = searchParams.get("download") === "1";

  if (!nickname) {
    return NextResponse.json({ error: "nickname이 필요합니다." }, { status: 400 });
  }
  if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) {
    return NextResponse.json({ error: "week(YYYY-MM-DD, 주의 일요일)이 필요합니다." }, { status: 400 });
  }

  const { from, to, label } = getWeekRangeKST(week);

  const { data: records, error: recError } = await admin
    .from("awakenings")
    .select("id, created_at, nickname, note, duration_type")
    .eq("nickname", nickname)
    .gte("created_at", from)
    .lte("created_at", to)
    .order("created_at", { ascending: true });

  if (recError) {
    return NextResponse.json({ error: recError.message }, { status: 500 });
  }

  const rows = (records ?? []) as RecordRow[];
  const notes = rows.map((r) => r.note).filter(Boolean);
  const keywordSummary = buildKeywordSummary(notes);
  const sentimentSummary = await getSentimentSummary(notes);

  try {
    await admin.from("ai_generated_content").insert({
      nickname,
      content_type: "weekly_summary",
      content: sentimentSummary,
      meta: { week, label },
    } as never);
  } catch {
    // 저장 실패해도 보고서 응답은 그대로 반환
  }

  const { data: planRow } = await admin
    .from("participant_plans")
    .select("plan_type, valid_until")
    .eq("nickname", nickname)
    .maybeSingle();

  const canDownload =
    planRow &&
    ["cho", "bun", "si"].includes((planRow as { plan_type: string }).plan_type) &&
    new Date((planRow as { valid_until: string }).valid_until) > new Date();

  const payload = {
    week,
    weekLabel: label,
    nickname,
    recordCount: rows.length,
    records: rows,
    sentimentSummary,
    keywordSummary,
    canDownload: !!canDownload,
  };

  if (download && canDownload) {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.getPageWidth();
      let y = 20;
      const lineH = 7;

      doc.setFontSize(16);
      doc.text("Weekly Report (주별 보고서)", 20, y);
      y += lineH * 2;
      doc.setFontSize(11);
      doc.text(`Week: ${label}`, 20, y);
      y += lineH;
      doc.text(`Nickname: ${nickname}`, 20, y);
      y += lineH;
      doc.text(`Records: ${rows.length}`, 20, y);
      y += lineH * 1.5;
      doc.text("Sentiment summary:", 20, y);
      y += lineH;
      const splitSentiment = doc.splitTextToSize(sentimentSummary, pageW - 40);
      doc.text(splitSentiment, 20, y);
      y += lineH * (splitSentiment.length + 1);
      doc.text("Top keywords:", 20, y);
      y += lineH;
      keywordSummary.slice(0, 10).forEach((k) => {
        doc.text(`  ${k.keyword}: ${k.count}`, 20, y);
        y += lineH;
      });
      const buf = doc.output("arraybuffer");
      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="weekly-report-${nickname}-${week}.pdf"`,
        },
      });
    } catch (e) {
      return NextResponse.json(
        { error: "PDF 생성 실패. jspdf 설치 여부를 확인하세요.", detail: String(e) },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(payload);
}
