import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { buildRuleBasedWarmMessage } from "@/lib/ruleBasedAi";
import { geminiGenerateText } from "@/lib/gemini";
import { chooseAiUserText } from "@/lib/aiUserText";

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nickname = searchParams.get("nickname")?.trim() ?? "";
  const durationType = searchParams.get("durationType")?.trim() || "1s";
  const validDuration = ["1s", "10s", "100s"].includes(durationType) ? durationType : "1s";

  if (!nickname) {
    return NextResponse.json(
      { error: "닉네임이 필요합니다.", message: null },
      { status: 400 }
    );
  }

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
  const profileHint =
    genderLabel || ageLabel
      ? ` (참고: ${[genderLabel, ageLabel].filter(Boolean).join(", ")}에 맞춰 공감할 수 있게)`
      : "";

  const text = notes.join("\n");
  const prompt = `다음은 오늘 사용자가 작성한 ${notes.length}개의 '${validDuration} 찰나' 기록입니다. 이를 바탕으로 사용자가 "이해받고 있다"는 느낌을 받을 수 있는 따뜻한 한마디를 한국어로 1~2문장으로 작성해 주세요.${profileHint}

작성 규칙:
- 첫 문장은 지금의 마음이나 흐름을 다정하게 알아봐 주는 공감
- 둘째 문장은 부담을 낮추는 작은 위로 또는 아주 가벼운 제안 1가지
- 성과, 생산성, 수익, 효율을 압박하는 말투 금지
- "오늘의 키워드:" 같은 목록형 표현, 따옴표 나열, 점(·) 나열 금지
- "(을)를", "(이)가" 같은 어색한 조사 표기 금지
- 짧지만 사람 냄새가 나게, 따뜻한 친구가 건네는 말처럼 작성

기록:
${text}`;

  const ruleBased = () =>
    buildRuleBasedWarmMessage({
      notes,
      durationType: validDuration as "1s" | "10s" | "100s",
      profileHint: { genderLabel, ageLabel },
    });

  try {
    const geminiPrompt =
      "당신은 사용자의 짧은 자각 기록을 읽고, 성장에 도움이 되는 따뜻한 한마디를 한국어로 1~2문장으로 작성하는 도우미입니다. " +
      "과장/단정/진단(의학적 판단) 없이 공감과 실행 가능한 한 가지 제안을 담으세요.\n\n" +
      prompt;
    const g1 = await geminiGenerateText({
      prompt: geminiPrompt,
      maxOutputTokens: 220,
      rateLimitKey: `warm:${nickname}`,
    });
    const ruleMessage = ruleBased();
    const geminiChoice = chooseAiUserText(g1.ok ? g1.text : "", ruleMessage);

    const shouldUseHighPrecision = validDuration === "1s";

    if (!OPENAI_API_KEY || !shouldUseHighPrecision) {
      const message = g1.ok ? geminiChoice.text : ruleMessage;
      try {
        await admin.from("ai_generated_content").insert({
          nickname,
          content_type: "warm_message",
          content: message,
          meta: g1.ok && geminiChoice.usedPrimary
            ? { durationType: validDuration, source: "gemini", model: g1.model }
            : {
                durationType: validDuration,
                source: "rule",
                reason: g1.ok ? "gemini_awkward_output" : "gemini_fallback",
                geminiError: !g1.ok ? g1.error : null,
                geminiStatus: !g1.ok ? g1.status ?? null : null,
                geminiFailureKind: !g1.ok ? g1.failureKind : null,
                geminiAwkwardOutput: g1.ok ? true : null,
              },
        } as never);
      } catch {
        // 저장 실패해도 생성된 메시지는 반환
      }
      return NextResponse.json({ message });
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
            content:
              "당신은 사용자의 자각 기록을 읽고 따뜻한 위로와 공감을 짧게 전하는 도우미입니다. 한국어로 1~2문장 이내로 작성하세요. " +
              "첫 문장은 공감, 둘째 문장은 부담을 낮추는 작은 제안 또는 위로로 마무리하세요. " +
              "성과/생산성/수익 압박, 키워드 목록, 점(·) 나열, 어색한 조사 표기 '(을)를' 같은 표현은 금지합니다.",
          },
          {
            role: "user",
            content:
              `${prompt}\n\n` +
              (refineSeed
                ? `참고로 Gemini가 1차로 만든 문장이 있습니다. 이를 더 자연스럽고 따뜻하게 다듬어 주세요(1~2문장 유지). 사용자가 위로받는 느낌이 우선이고, 생산성 압박처럼 들리면 안 됩니다.\nGemini 초안:\n${refineSeed}`
                : "1~2문장으로 공감과 위로를 먼저 주고, 아주 가벼운 제안 1가지만 포함해 작성해 주세요."),
          },
        ],
        max_tokens: 200,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      const message = g1.ok ? geminiChoice.text : ruleMessage;
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
    const message = openaiChoice.text;
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
              }
            : {
                durationType: validDuration,
                source: fallbackSource,
                openaiRefineFailed: true,
                openaiEmptyChoice: !rawMsg || rawMsg.length === 0,
                openaiAwkwardOutput: rawMsg && rawMsg.length > 0 ? true : null,
                geminiModel: g1.ok && geminiChoice.usedPrimary ? g1.model : null,
                geminiAwkwardOutput: g1.ok && !geminiChoice.usedPrimary ? true : null,
              },
      } as never);
    } catch {
      // 저장 실패해도 생성된 메시지는 반환
    }
    return NextResponse.json({ message });
  } catch (e) {
    const g1 = await geminiGenerateText({
      prompt:
        "한국어로 1~2문장 따뜻한 한마디를 작성해 주세요. 공감과 위로가 먼저 느껴져야 하며, 키워드 목록이나 어색한 조사 표기는 쓰지 마세요.\n\n" +
        prompt,
      maxOutputTokens: 220,
      rateLimitKey: `warm:${nickname}`,
    });
    const ruleMessage = ruleBased();
    const geminiChoice = chooseAiUserText(g1.ok ? g1.text : "", ruleMessage);
    const message = g1.ok ? geminiChoice.text : ruleMessage;
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
        },
      } as never);
    } catch {
      // ignore
    }
    return NextResponse.json({ message });
  }
}
