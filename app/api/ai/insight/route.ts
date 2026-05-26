import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireParticipantAuth } from "@/lib/participantApiAuth";
import {
  AI_KOREAN_STYLE_RULES,
  buildAiKoreanGeminiPreamble,
  buildAiKoreanOpenAiSystem,
  finalizeAiKoreanMessage,
} from "@/lib/aiKoreanMessageFormat";
import { buildRuleBasedInsightCard } from "@/lib/ruleBasedAi";
import { geminiGenerateText } from "@/lib/gemini";
import { chooseAiUserText } from "@/lib/aiUserText";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

type AwRow = { note: string; duration_type: string | null };

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nickname = searchParams.get("nickname")?.trim() ?? "";
  const authHash = (searchParams.get("authHash") ?? "").trim();

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "DB 연결을 사용할 수 없습니다.", card: null },
      { status: 503 }
    );
  }

  let rows: AwRow[] = [];
  if (nickname) {
    const auth = await requireParticipantAuth(nickname, authHash);
    if (!auth.ok) return auth.response;

    const { data: byNick } = await admin
      .from("awakenings")
      .select("note, duration_type")
      .eq("nickname", nickname)
      .order("created_at", { ascending: false })
      .limit(50);
    rows = (byNick ?? []) as AwRow[];
  } else {
    const { data: allRows } = await admin
      .from("awakenings")
      .select("note, duration_type")
      .eq("is_public", true)
      .eq("moderation_state", "ok")
      .order("created_at", { ascending: false })
      .limit(100);
    rows = (allRows ?? []) as AwRow[];
  }

  const notes = rows.map((r) => r.note).filter(Boolean);
  const hasDecisional1s = rows.some((r) => String(r.duration_type ?? "") === "1s");

  const textSample = notes.slice(0, 30).join("\n");
  if (!textSample.trim()) {
    return NextResponse.json({
      card: "아직 기록이 쌓이면 감응 트렌드와 맞춤 카드가 표시됩니다.",
    });
  }

  let profileHint = "";
  let genderLabel: string | null = null;
  let ageLabel: string | null = null;
  if (nickname) {
    const profileRes = await admin
      .from("participant_profiles")
      .select("gender, age_group")
      .eq("nickname", nickname)
      .maybeSingle();
    const profileRow = profileRes.data as { gender: string | null; age_group: string | null } | null;
    genderLabel = profileRow?.gender === "male" ? "남성" : profileRow?.gender === "female" ? "여성" : null;
    const ageLabels: Record<string, string> = {
      "13under": "13세 이하",
      "14_16": "14-16세",
      "17_19": "17-19세",
      "20s": "20대",
      "30s": "30대",
      "40s": "40대",
      "50s": "50대",
      "60s": "60대",
      "70over": "70대 이상",
    };
    ageLabel =
      profileRow?.age_group && profileRow.age_group !== "defer" ? ageLabels[profileRow.age_group] ?? null : null;
    if (genderLabel || ageLabel) {
      profileHint = ` 성별·연령(참고: ${[genderLabel, ageLabel].filter(Boolean).join(", ")})에 맞춘 공감을 담아 주세요.`;
    }
  }

  const ruleBased = () =>
    buildRuleBasedInsightCard({
      notes,
      nickname: nickname || undefined,
      profileHint: { genderLabel, ageLabel },
    });

  const prompt = nickname
    ? `다음은 한 사용자의 자각 기록 일부입니다. 맞춤 감응 카드 한 문단을 작성해 주세요.${profileHint}

필수 조건:
${AI_KOREAN_STYLE_RULES}
- 기록 속 흐름·감정을 짚는 공감과, 마음이 움직이는 작은 희망을 한데 담을 것

기록:
${textSample}`
    : `다음은 여러 참여자의 자각 기록 일부입니다. "이번 감응 트렌드" 카드 한 문단을 작성해 주세요.

필수 조건:
${AI_KOREAN_STYLE_RULES}
- 전체 흐름에 대한 따뜻한 공감과 가벼운 격려

기록:
${textSample}`;

  const geminiPrompt =
    `${buildAiKoreanGeminiPreamble("당신은 감응(Resonans) 맞춤 감응 카드 문구를 쓰는 도우미입니다.")}\n\n` +
    prompt;

  const finalizeCard = (primary: string, ruleCard: string, usedPrimary: boolean) =>
    finalizeAiKoreanMessage(usedPrimary ? primary : ruleCard, ruleCard, primary);

  try {
    const g1 = await geminiGenerateText({
      prompt: geminiPrompt,
      maxOutputTokens: 150,
      rateLimitKey: `insight:${nickname || "trend"}`,
    });

    const ruleCard = ruleBased();
    const geminiChoice = chooseAiUserText(g1.ok ? g1.text : "", ruleCard);
    const shouldUseHighPrecision = hasDecisional1s && !!OPENAI_API_KEY;

    if (!shouldUseHighPrecision) {
      const card = finalizeCard(geminiChoice.text, ruleCard, geminiChoice.usedPrimary);
      try {
        await admin.from("ai_generated_content").insert({
          nickname: nickname || null,
          content_type: "insight_card",
          content: card,
          meta: g1.ok && geminiChoice.usedPrimary
            ? { source: "gemini", model: g1.model, scope: nickname ? "personal" : "trend", hasDecisional1s }
            : {
                source: "rule",
                scope: nickname ? "personal" : "trend",
                reason: g1.ok ? "gemini_awkward_output" : "gemini_fallback",
                hasDecisional1s,
                geminiError: !g1.ok ? g1.error : null,
                geminiStatus: !g1.ok ? g1.status ?? null : null,
                geminiFailureKind: !g1.ok ? g1.failureKind : null,
                geminiAwkwardOutput: g1.ok ? true : null,
              },
        } as never);
      } catch {
        // ignore
      }
      return NextResponse.json({ card });
    }

    const refineSeed = g1.ok ? g1.text : "";
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
              "당신은 감응(Resonans) 맞춤 감응 카드 문구를 작성하는 도우미입니다."
            ),
          },
          {
            role: "user",
            content:
              `${prompt}\n\n` +
              (refineSeed
                ? `참고 초안(Gemini). 100자 이내로 맞춤법·문맥을 다듬고 감동적으로:\n${refineSeed}`
                : "100자 이내로 따뜻하고 감동적으로 작성해 주세요."),
          },
        ],
        max_tokens: 150,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      const card = finalizeCard(geminiChoice.text, ruleCard, geminiChoice.usedPrimary);
      try {
        await admin.from("ai_generated_content").insert({
          nickname: nickname || null,
          content_type: "insight_card",
          content: card,
          meta: {
            source: g1.ok && geminiChoice.usedPrimary ? "gemini" : "rule",
            scope: nickname ? "personal" : "trend",
            hasDecisional1s,
            openaiRefineFailed: true,
            openaiStatus: res.status,
            openaiError: err?.slice(0, 2000) || null,
            geminiModel: g1.ok && geminiChoice.usedPrimary ? g1.model : null,
            geminiAwkwardOutput: g1.ok && !geminiChoice.usedPrimary ? true : null,
            geminiFailureKind: !g1.ok ? g1.failureKind : null,
          },
        } as never);
      } catch {
        // ignore
      }
      return NextResponse.json({ card });
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const rawCard = json.choices?.[0]?.message?.content?.trim();
    const openaiChoice = chooseAiUserText(rawCard, g1.ok ? geminiChoice.text : ruleCard);
    const card = finalizeCard(openaiChoice.text, ruleCard, openaiChoice.usedPrimary);
    const fallbackSource = g1.ok && geminiChoice.usedPrimary ? "gemini" : "rule";

    try {
      await admin.from("ai_generated_content").insert({
        nickname: nickname || null,
        content_type: "insight_card",
        content: card,
        meta:
          openaiChoice.usedPrimary
            ? {
                source: "openai",
                model: "gpt-4o",
                scope: nickname ? "personal" : "trend",
                hasDecisional1s,
                upstream: g1.ok && geminiChoice.usedPrimary ? { source: "gemini", model: g1.model } : { source: "rule" },
              }
            : {
                source: fallbackSource,
                scope: nickname ? "personal" : "trend",
                hasDecisional1s,
                openaiRefineFailed: true,
                openaiEmptyChoice: !rawCard || rawCard.length === 0,
                openaiAwkwardOutput: rawCard && rawCard.length > 0 ? true : null,
                geminiModel: g1.ok && geminiChoice.usedPrimary ? g1.model : null,
                geminiAwkwardOutput: g1.ok && !geminiChoice.usedPrimary ? true : null,
              },
      } as never);
    } catch {
      // 저장 실패해도 생성된 카드는 반환
    }
    return NextResponse.json({ card });
  } catch (e) {
    const g1 = await geminiGenerateText({
      prompt: geminiPrompt,
      maxOutputTokens: 150,
      rateLimitKey: `insight:${nickname || "trend"}`,
    });
    const ruleCard = ruleBased();
    const geminiChoice = chooseAiUserText(g1.ok ? g1.text : "", ruleCard);
    const card = finalizeCard(geminiChoice.text, ruleCard, geminiChoice.usedPrimary);
    try {
      await admin.from("ai_generated_content").insert({
        nickname: nickname || null,
        content_type: "insight_card",
        content: card,
        meta: {
          source: g1.ok && geminiChoice.usedPrimary ? "gemini" : "rule",
          scope: nickname ? "personal" : "trend",
          hasDecisional1s,
          openaiException: String(e).slice(0, 2000),
          geminiAwkwardOutput: g1.ok && !geminiChoice.usedPrimary ? true : null,
          geminiFailureKind: !g1.ok ? g1.failureKind : null,
          geminiError: !g1.ok ? g1.error : null,
          geminiStatus: !g1.ok ? g1.status ?? null : null,
        },
      } as never);
    } catch {
      // ignore
    }
    return NextResponse.json({ card });
  }
}
