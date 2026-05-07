import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { buildRuleBasedWarmMessage } from "@/lib/ruleBasedAi";

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

  const { data: profileRow } = await admin
    .from("participant_profiles")
    .select("gender, age_group")
    .eq("nickname", nickname)
    .maybeSingle() as { data: { gender: string | null; age_group: string | null } | null };

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
  const prompt = `다음은 오늘 사용자가 작성한 ${notes.length}개의 '${validDuration} 찰나' 기록입니다. 이를 바탕으로 성장을 위한 따뜻한 한마디를 1~2문장으로 한국어로 작성해 주세요. 격려와 공감, 앞으로의 성장을 담아 주세요.${profileHint}\n\n기록:\n${text}`;

  const ruleBased = () =>
    buildRuleBasedWarmMessage({
      notes,
      durationType: validDuration as "1s" | "10s" | "100s",
      profileHint: { genderLabel, ageLabel },
    });

  try {
    if (!OPENAI_API_KEY) {
      const message = ruleBased();
      try {
        await admin.from("ai_generated_content").insert({
          nickname,
          content_type: "warm_message",
          content: message,
          meta: { durationType: validDuration, source: "rule", reason: "missing_openai_key" },
        } as never);
      } catch {
        // 저장 실패해도 생성된 메시지는 반환
      }
      return NextResponse.json({
        message,
        source: "rule",
        warning: "일시적 문제로 룰베이스 메시지로 제공 중입니다.",
      });
    }

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
              "당신은 사용자의 자각 기록을 읽고 성장을 위한 따뜻한 한마디를 짧게 전하는 도우미입니다. 한국어로 1~2문장 이내로 작성하세요.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 200,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      const message = ruleBased();
      try {
        await admin.from("ai_generated_content").insert({
          nickname,
          content_type: "warm_message",
          content: message,
          meta: {
            durationType: validDuration,
            source: "rule",
            openaiStatus: res.status,
            openaiError: err?.slice(0, 2000) || null,
          },
        } as never);
      } catch {
        // ignore
      }
      return NextResponse.json({
        message,
        source: "rule",
        warning: "일시적 문제로 룰베이스 메시지로 제공 중입니다.",
      });
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const message =
      json.choices?.[0]?.message?.content?.trim() ??
      "따뜻한 한마디를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.";

    try {
      await admin.from("ai_generated_content").insert({
        nickname,
        content_type: "warm_message",
        content: message,
        meta: { durationType: validDuration, source: "openai", model: "gpt-4o" },
      } as never);
    } catch {
      // 저장 실패해도 생성된 메시지는 반환
    }
    return NextResponse.json({ message, source: "openai" });
  } catch (e) {
    const message = ruleBased();
    try {
      await admin.from("ai_generated_content").insert({
        nickname,
        content_type: "warm_message",
        content: message,
        meta: {
          durationType: validDuration,
          source: "rule",
          openaiException: String(e).slice(0, 2000),
        },
      } as never);
    } catch {
      // ignore
    }
    return NextResponse.json({
      message,
      source: "rule",
      warning: "일시적 문제로 룰베이스 메시지로 제공 중입니다.",
    });
  }
}
