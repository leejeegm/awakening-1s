import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireParticipantAuth } from "@/lib/participantApiAuth";
import { getWeekRangeKST } from "@/lib/weekRange";
import {
  AI_KOREAN_STYLE_RULES,
  buildAiKoreanGeminiPreamble,
  buildAiKoreanOpenAiSystem,
  finalizeAiKoreanMessage,
} from "@/lib/aiKoreanMessageFormat";
import { buildRuleBasedWeeklySummary } from "@/lib/ruleBasedAi";
import { geminiGenerateText } from "@/lib/gemini";
import { chooseAiUserText } from "@/lib/aiUserText";

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

async function getSentimentSummary(
  notes: string[],
  hasDecisional1s: boolean,
  nickname: string
): Promise<{
  summary: string;
  source: "openai" | "gemini" | "rule";
  model: string | null;
  diagnostics: Record<string, unknown>;
}> {
  if (notes.length === 0) {
    return { summary: "이번 주 기록이 없어 요약할 내용이 없습니다.", source: "rule", model: null, diagnostics: {} };
  }

  const text = notes.slice(0, 30).join("\n");
  const userBlock = `다음은 한 주간의 자각 기록입니다. 주간 감응 요약 한 문단을 작성해 주세요.

필수 조건:
${AI_KOREAN_STYLE_RULES}
- 이번 주 흐름에 대한 공감과, 다음 주를 향한 따뜻한 응원을 담을 것

기록:
${text}`;
  const geminiPrompt =
    `${buildAiKoreanGeminiPreamble("당신은 사용자의 자각 기록을 읽고 한 주를 요약하는 도우미입니다.")}\n\n` +
    userBlock;

  const finalizeSummary = (primary: string, ruleSummary: string, usedPrimary: boolean) =>
    finalizeAiKoreanMessage(usedPrimary ? primary : ruleSummary, ruleSummary, primary);

  const g1 = await geminiGenerateText({
    prompt: geminiPrompt,
    maxOutputTokens: 150,
    rateLimitKey: `weekly:${nickname}`,
  });

  const ruleSummary = buildRuleBasedWeeklySummary(notes);
  const geminiChoice = chooseAiUserText(g1.ok ? g1.text : "", ruleSummary);

  const ruleFallback = () => ({
    summary: ruleSummary,
    source: "rule" as const,
    model: null as null,
    diagnostics: !g1.ok
      ? {
          reason: "gemini_fallback",
          geminiFailureKind: g1.failureKind,
          geminiError: g1.error,
          geminiStatus: g1.status ?? null,
        }
      : geminiChoice.primaryWasAwkward
        ? {
            reason: "gemini_awkward_output",
            geminiAwkwardOutput: true,
          }
      : {},
  });

  /** 주간 요약에는 '결정적 찰나(1s)' 기록이 있을 때만 고성능 모델로 정밀화 */
  const shouldUseHighPrecision = hasDecisional1s && !!OPENAI_API_KEY;

  if (!shouldUseHighPrecision) {
    if (g1.ok && geminiChoice.usedPrimary) {
      return {
        summary: finalizeSummary(geminiChoice.text, ruleSummary, true),
        source: "gemini",
        model: g1.model,
        diagnostics: {},
      };
    }
    const r = ruleFallback();
    return { summary: r.summary, source: r.source, model: r.model, diagnostics: r.diagnostics };
  }

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
            content: buildAiKoreanOpenAiSystem(
              "당신은 사용자의 자각 기록을 읽고 한 주를 요약하는 보고서 도우미입니다."
            ),
          },
          {
            role: "user",
            content:
              `${userBlock}\n\n` +
              (g1.ok
                ? `참고 초안(Gemini). 100자 이내로 맞춤법·문맥을 다듬고 감동적으로:\n${g1.text}`
                : ""),
          },
        ],
        max_tokens: 150,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      if (g1.ok && geminiChoice.usedPrimary) {
        return {
          summary: finalizeSummary(geminiChoice.text, ruleSummary, true),
          source: "gemini",
          model: g1.model,
          diagnostics: {
            openaiRefineFailed: true,
            openaiStatus: res.status,
            openaiError: errBody.slice(0, 2000),
          },
        };
      }
      const r = ruleFallback();
      return {
        summary: r.summary,
        source: r.source,
        model: r.model,
        diagnostics: {
          ...r.diagnostics,
          openaiRefineFailed: true,
          openaiStatus: res.status,
          openaiError: errBody.slice(0, 2000),
        },
      };
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content?.trim();
    const openaiChoice = chooseAiUserText(content, g1.ok ? geminiChoice.text : ruleSummary);
    if (!openaiChoice.usedPrimary) {
      if (g1.ok && geminiChoice.usedPrimary) {
        return {
          summary: finalizeSummary(geminiChoice.text, ruleSummary, true),
          source: "gemini",
          model: g1.model,
          diagnostics: {
            openaiRefineFailed: true,
            openaiEmptyChoice: !content || content.length === 0,
            openaiAwkwardOutput: content && content.length > 0 ? true : null,
          },
        };
      }
      const r = ruleFallback();
      return {
        summary: r.summary,
        source: r.source,
        model: r.model,
        diagnostics: {
          ...r.diagnostics,
          openaiRefineFailed: true,
          openaiEmptyChoice: !content || content.length === 0,
          openaiAwkwardOutput: content && content.length > 0 ? true : null,
        },
      };
    }
    return {
      summary: finalizeSummary(openaiChoice.text, ruleSummary, openaiChoice.usedPrimary),
      source: "openai",
      model: "gpt-4o",
      diagnostics: {},
    };
  } catch {
    if (g1.ok && geminiChoice.usedPrimary) {
      return {
        summary: finalizeSummary(geminiChoice.text, ruleSummary, true),
        source: "gemini",
        model: g1.model,
        diagnostics: { openaiRefineFailed: true },
      };
    }
    const r = ruleFallback();
    return { summary: r.summary, source: r.source, model: r.model, diagnostics: r.diagnostics };
  }
}

export async function GET(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "DB 연결을 사용할 수 없습니다." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const nickname = searchParams.get("nickname")?.trim() ?? "";
  const authHash = (searchParams.get("authHash") ?? "").trim();
  const week = searchParams.get("week") ?? ""; // YYYY-MM-DD (일요일)
  const download = searchParams.get("download") === "1";

  if (!nickname) {
    return NextResponse.json({ error: "nickname이 필요합니다." }, { status: 400 });
  }
  if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) {
    return NextResponse.json({ error: "week(YYYY-MM-DD, 주의 일요일)이 필요합니다." }, { status: 400 });
  }

  const auth = await requireParticipantAuth(nickname, authHash);
  if (!auth.ok) return auth.response;

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
  const hasDecisional1s = rows.some((r) => String(r.duration_type ?? "") === "1s");
  const sentiment = await getSentimentSummary(notes, hasDecisional1s, nickname);

  try {
    await admin.from("ai_generated_content").insert({
      nickname,
      content_type: "weekly_summary",
      content: sentiment.summary,
      meta: {
        week,
        label,
        source: sentiment.source,
        model: sentiment.model,
        hasDecisional1s,
        ...sentiment.diagnostics,
      },
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
    sentimentSummary: sentiment.summary,
    keywordSummary,
    canDownload: !!canDownload,
  };

  if (download && canDownload) {
    try {
      const { jsPDF } = await import("jspdf");
      const { registerKoreanPdfFonts, setKoreanPdfFont } = await import("@/lib/jspdfKoreanFont");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      registerKoreanPdfFonts(doc);
      const pageW = doc.internal.pageSize.getWidth();
      let y = 20;
      const lineH = 7;

      setKoreanPdfFont(doc, "bold");
      doc.setFontSize(16);
      doc.text("주간 감응 보고서", 20, y);
      y += lineH * 2;
      setKoreanPdfFont(doc, "normal");
      doc.setFontSize(11);
      doc.text(`주간: ${label}`, 20, y);
      y += lineH;
      doc.text(`닉네임: ${nickname}`, 20, y);
      y += lineH;
      doc.text(`기록 수: ${rows.length}`, 20, y);
      y += lineH * 1.5;
      doc.text("이번 주 감응 요약:", 20, y);
      y += lineH;
      const splitSentiment = doc.splitTextToSize(sentiment.summary, pageW - 40);
      doc.text(splitSentiment, 20, y);
      y += lineH * (splitSentiment.length + 1);
      doc.text("주요 키워드:", 20, y);
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
