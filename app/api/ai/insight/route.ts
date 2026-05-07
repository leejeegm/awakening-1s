import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { buildRuleBasedInsightCard } from "@/lib/ruleBasedAi";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nickname = searchParams.get("nickname")?.trim() ?? "";

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "DB 연결을 사용할 수 없습니다.", card: null },
      { status: 503 }
    );
  }

  let notes: string[] = [];
  const { data } = await admin
    .from("awakenings")
    .select("note")
    .order("created_at", { ascending: false })
    .limit(nickname ? 50 : 100);

  const rows = (data ?? []) as { note: string }[];
  if (nickname) {
    const byNick = await admin
      .from("awakenings")
      .select("note")
      .eq("nickname", nickname)
      .order("created_at", { ascending: false })
      .limit(50);
    notes = ((byNick.data ?? []) as { note: string }[]).map((r) => r.note);
  } else {
    notes = rows.map((r) => r.note);
  }

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
    const { data: profileRow } = await admin
      .from("participant_profiles")
      .select("gender, age_group")
      .eq("nickname", nickname)
      .maybeSingle() as { data: { gender: string | null; age_group: string | null } | null };
    genderLabel = profileRow?.gender === "male" ? "남성" : profileRow?.gender === "female" ? "여성" : null;
    const ageLabels: Record<string, string> = {
      "13under": "13세 이하", "14_16": "14-16세", "17_19": "17-19세",
      "20s": "20대", "30s": "30대", "40s": "40대", "50s": "50대", "60s": "60대", "70over": "70대 이상",
    };
    ageLabel = profileRow?.age_group && profileRow.age_group !== "defer" ? ageLabels[profileRow.age_group] ?? null : null;
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
    ? `다음은 한 닉네임 사용자의 자각 기록 일부입니다. 키워드와 감정을 간단히 분석해, 긍정·창의·혁신·개방 관점에서 한 문단짜리 맞춤 카드 뉴스(동기부여 문구)를 한국어로 작성해 주세요. 2문장 이내로 짧게.${profileHint}\n\n기록:\n${textSample}`
    : `다음은 여러 참여자의 자각 기록 일부입니다. 공통 키워드와 감응 트렌드를 간단히 분석해, 한 문단짜리 "이번 주 감응 트렌드" 카드 뉴스를 한국어로 작성해 주세요. 긍정·창의·혁신·개방 중 하나를 강조하고 2문장 이내로.\n\n기록:\n${textSample}`;

  try {
    if (!OPENAI_API_KEY) {
      const card = ruleBased();
      try {
        await admin.from("ai_generated_content").insert({
          nickname: nickname || null,
          content_type: "insight_card",
          content: card,
          meta: { source: "rule", reason: "missing_openai_key", scope: nickname ? "personal" : "trend" },
        } as never);
      } catch {
        // ignore
      }
      return NextResponse.json({
        card,
        source: "rule",
        warning: "일시적 문제로 룰베이스 카드로 제공 중입니다.",
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
              "당신은 감응(Resonans) 실험을 위한 짧은 인사이트와 동기부여 문구를 작성하는 도우미입니다. 한국어로만 답하고, 2문장 이내로 간결하게 작성하세요.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      const card = ruleBased();
      try {
        await admin.from("ai_generated_content").insert({
          nickname: nickname || null,
          content_type: "insight_card",
          content: card,
          meta: {
            source: "rule",
            scope: nickname ? "personal" : "trend",
            openaiStatus: res.status,
            openaiError: err?.slice(0, 2000) || null,
          },
        } as never);
      } catch {
        // ignore
      }
      return NextResponse.json({
        card,
        source: "rule",
        warning: "일시적 문제로 룰베이스 카드로 제공 중입니다.",
      });
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const card =
      json.choices?.[0]?.message?.content?.trim() ??
      "감응 트렌드를 분석 중입니다. 잠시 후 다시 시도해 주세요.";

    try {
      await admin.from("ai_generated_content").insert({
        nickname: nickname || null,
        content_type: "insight_card",
        content: card,
        meta: { source: "openai", model: "gpt-4o", scope: nickname ? "personal" : "trend" },
      } as never);
    } catch {
      // 저장 실패해도 생성된 카드는 반환
    }
    return NextResponse.json({ card, source: "openai" });
  } catch (e) {
    const card = ruleBased();
    try {
      await admin.from("ai_generated_content").insert({
        nickname: nickname || null,
        content_type: "insight_card",
        content: card,
        meta: {
          source: "rule",
          scope: nickname ? "personal" : "trend",
          openaiException: String(e).slice(0, 2000),
        },
      } as never);
    } catch {
      // ignore
    }
    return NextResponse.json({
      card,
      source: "rule",
      warning: "일시적 문제로 룰베이스 카드로 제공 중입니다.",
    });
  }
}
