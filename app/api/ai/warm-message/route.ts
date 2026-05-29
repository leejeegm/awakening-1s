import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireParticipantAuth } from "@/lib/participantApiAuth";
import { buildRuleBasedWarmMessage } from "@/lib/ruleBasedAi";
import { geminiGenerateText } from "@/lib/gemini";
import { chooseAiUserText } from "@/lib/aiUserText";
import {
  buildWarmMessageGeminiSystemPreamble,
  buildWarmMessageOpenAiSystemPrompt,
  buildWarmMessagePrompt,
  finalizeWarmMessage,
} from "@/lib/warmMessageFormat";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

/** 오늘(KST) 00:00 ~ 23:59:59 ISO 범위 */
function getTodayKSTRange(): { from: string; to: string } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayStr = formatter.format(new Date()).replace(/\//g, "-");
  return {
    from: `${todayStr}T00:00:00.000+09:00`,
    to: `${todayStr}T23:59:59.999+09:00`,
  };
}

function resolveWarmMessage(
  primary: string,
  ruleMessage: string,
  usedPrimary: boolean
): string {
  return finalizeWarmMessage(usedPrimary ? primary : ruleMessage, ruleMessage, primary);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nickname = searchParams.get("nickname")?.trim() ?? "";
  const authHash = (searchParams.get("authHash") ?? "").trim();
  const durationType = searchParams.get("durationType")?.trim() || "1s";
  const validDuration = ["1s", "10s", "100s"].includes(durationType) ? durationType : "1s";

  if (!nickname) {
    return NextResponse.json(
      { error: "닉네임이 필요합니다.", message: null },
      { status: 400 }
    );
  }

  const auth = await requireParticipantAuth(nickname, authHash);
  if (!auth.ok) return auth.response;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "DB 연결을 사용할 수 없습니다.", message: null },
      { status: 503 }
    );
  }

  const { from, to } = getTodayKSTRange();
  const { data } = await admin
    .from("awakenings")
    .select("note")
    .eq("nickname", nickname)
    .eq("duration_type", validDuration)
    .gte("created_at", from)
    .lte("created_at", to)
    .order("created_at", { ascending: false })
    .limit(3);

  const notes = ((data ?? []) as { note: string }[]).map((r) => r.note).filter(Boolean);
  if (notes.length === 0) {
    return NextResponse.json({
      message: `오늘 작성한 ${validDuration} 찰나 기록이 없습니다. 먼저 찰나를 기록해 보세요.`,
    });
  }

  const profileRes = await admin
    .from("participant_profiles")
    .select("gender, age_group")
    .eq("nickname", nickname)
    .maybeSingle();
  const profileRow = profileRes.data as { gender: string | null; age_group: string | null } | null;

  const genderLabel = profileRow?.gender === "male" ? "남성" : profileRow?.gender === "female" ? "여성" : null;
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
  const ageLabel = profileRow?.age_group && profileRow.age_group !== "defer"
    ? ageLabels[profileRow.age_group] ?? null
    : null;

  const prompt = buildWarmMessagePrompt({
    notes,
    durationType: validDuration as "1s" | "10s" | "100s",
    profile: { genderLabel, ageLabel },
  });

  const ruleBased = () =>
    buildRuleBasedWarmMessage({
      notes,
      durationType: validDuration as "1s" | "10s" | "100s",
      profileHint: { genderLabel, ageLabel },
    });

  try {
    const geminiPrompt = `${buildWarmMessageGeminiSystemPreamble()}\n\n${prompt}`;
    const g1 = await geminiGenerateText({
      prompt: geminiPrompt,
      maxOutputTokens: 512,
      rateLimitKey: `warm:${nickname}`,
    });
    const ruleMessage = ruleBased();
    const geminiChoice = chooseAiUserText(g1.ok ? g1.text : "", ruleMessage);

    const shouldUseHighPrecision = validDuration === "1s";

    if (!OPENAI_API_KEY || !shouldUseHighPrecision) {
      const message = resolveWarmMessage(geminiChoice.text, ruleMessage, geminiChoice.usedPrimary);
      try {
        await admin.from("ai_generated_content").insert({
          nickname,
          content_type: "warm_message",
          content: message,
          meta: g1.ok && geminiChoice.usedPrimary
            ? { durationType: validDuration, source: "gemini", model: g1.model, charCount: message.length }
            : {
                durationType: validDuration,
                source: "rule",
                reason: g1.ok ? "gemini_awkward_output" : "gemini_fallback",
                geminiError: !g1.ok ? g1.error : null,
                geminiStatus: !g1.ok ? g1.status ?? null : null,
                geminiFailureKind: !g1.ok ? g1.failureKind : null,
                geminiAwkwardOutput: g1.ok ? true : null,
                charCount: message.length,
              },
        } as never);
      } catch {
        // 저장 실패해도 생성된 메시지는 반환
      }
      return NextResponse.json({ message });
    }

    const refineSeed = g1.ok ? geminiChoice.text : "";
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: buildWarmMessageOpenAiSystemPrompt() },
          {
            role: "user",
            content:
              `${prompt}\n\n` +
              (refineSeed
                ? `참고 초안(Gemini). 100자 이내로 맞춤법·문맥을 다듬고 감동적으로:\n${refineSeed}`
                : "100자 이내로 공감과 감동적인 격려를 담아 작성해 주세요."),
          },
        ],
        max_tokens: 150,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      const message = resolveWarmMessage(geminiChoice.text, ruleMessage, geminiChoice.usedPrimary);
      try {
        await admin.from("ai_generated_content").insert({
          nickname,
          content_type: "warm_message",
          content: message,
          meta: {
            durationType: validDuration,
            source: g1.ok && geminiChoice.usedPrimary ? "gemini" : "rule",
            openaiRefineFailed: true,
            openaiStatus: res.status,
            openaiError: err?.slice(0, 2000) || null,
            geminiModel: g1.ok && geminiChoice.usedPrimary ? g1.model : null,
            geminiAwkwardOutput: g1.ok && !geminiChoice.usedPrimary ? true : null,
            geminiError: !g1.ok ? g1.error : null,
            geminiStatus: !g1.ok ? g1.status ?? null : null,
            geminiFailureKind: !g1.ok ? g1.failureKind : null,
            charCount: message.length,
          },
        } as never);
      } catch {
        // ignore
      }
      return NextResponse.json({ message });
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const rawMsg = json.choices?.[0]?.message?.content?.trim();
    const openaiChoice = chooseAiUserText(rawMsg, g1.ok ? geminiChoice.text : ruleMessage);
    const message = resolveWarmMessage(openaiChoice.text, ruleMessage, openaiChoice.usedPrimary);
    const fallbackSource = g1.ok && geminiChoice.usedPrimary ? "gemini" : "rule";

    try {
      await admin.from("ai_generated_content").insert({
        nickname,
        content_type: "warm_message",
        content: message,
        meta:
          openaiChoice.usedPrimary
            ? {
                durationType: validDuration,
                source: "openai",
                model: "gpt-4o",
                upstream: g1.ok && geminiChoice.usedPrimary ? { source: "gemini", model: g1.model } : { source: "rule" },
                charCount: message.length,
              }
            : {
                durationType: validDuration,
                source: fallbackSource,
                openaiRefineFailed: true,
                openaiEmptyChoice: !rawMsg || rawMsg.length === 0,
                openaiAwkwardOutput: rawMsg && rawMsg.length > 0 ? true : null,
                geminiModel: g1.ok && geminiChoice.usedPrimary ? g1.model : null,
                geminiAwkwardOutput: g1.ok && !geminiChoice.usedPrimary ? true : null,
                charCount: message.length,
              },
      } as never);
    } catch {
      // 저장 실패해도 생성된 메시지는 반환
    }
    return NextResponse.json({ message });
  } catch (e) {
    const g1 = await geminiGenerateText({
      prompt: `${buildWarmMessageGeminiSystemPreamble()}\n\n${prompt}`,
      maxOutputTokens: 512,
      rateLimitKey: `warm:${nickname}`,
    });
    const ruleMessage = ruleBased();
    const geminiChoice = chooseAiUserText(g1.ok ? g1.text : "", ruleMessage);
    const message = resolveWarmMessage(geminiChoice.text, ruleMessage, geminiChoice.usedPrimary);
    try {
      await admin.from("ai_generated_content").insert({
        nickname,
        content_type: "warm_message",
        content: message,
        meta: {
          durationType: validDuration,
          source: g1.ok && geminiChoice.usedPrimary ? "gemini" : "rule",
          openaiException: String(e).slice(0, 2000),
          geminiModel: g1.ok && geminiChoice.usedPrimary ? g1.model : null,
          geminiAwkwardOutput: g1.ok && !geminiChoice.usedPrimary ? true : null,
          geminiError: !g1.ok ? g1.error : null,
          geminiStatus: !g1.ok ? g1.status ?? null : null,
          geminiFailureKind: !g1.ok ? g1.failureKind : null,
          charCount: message.length,
        },
      } as never);
    } catch {
      // ignore
    }
    return NextResponse.json({ message });
  }
}
