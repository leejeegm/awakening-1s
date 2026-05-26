import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { moderateForPublicShare } from "@/lib/moderation";
import { getClientIp } from "@/lib/requestIp";
import { isResonanceKindId } from "@/lib/resonanceEssence";

type Body = {
  nickname?: string;
  note?: string;
  durationType?: "1s" | "10s" | "100s";
  resonanceKind?: string | null;
  gender?: "male" | "female" | "defer" | null;
  ageGroup?: string | null;
  isPublic?: boolean;
};

export async function POST(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "서버 설정 오류" }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "요청 형식 오류" }, { status: 400 });
  }

  const nickname = (body.nickname ?? "").trim().slice(0, 20);
  const note = (body.note ?? "").trim();
  const durationType = body.durationType && ["1s", "10s", "100s"].includes(body.durationType) ? body.durationType : "1s";
  const isPublicRequested = !!body.isPublic;

  if (!nickname || !note) {
    return NextResponse.json({ ok: false, error: "닉네임과 내용을 입력해 주세요." }, { status: 400 });
  }

  const maxLen = durationType === "1s" ? 80 : durationType === "10s" ? 60 : 100;
  const noteSliced = note.slice(0, maxLen);

  let isPublic = isPublicRequested;
  let moderation_state: "ok" | "deleted" = "ok";
  let moderation_reason: string | null = null;
  let deleted_at: string | null = null;
  let deleted_by: string | null = null;

  if (isPublicRequested) {
    const mod = await moderateForPublicShare(noteSliced, {
      durationType,
      clientIp: getClientIp(request),
    });
    if (!mod.allowed && mod.severity === "block") {
      // 공개 공유는 차단: 저장은 하되 공개되지 않도록 "삭제(보관)" 상태로 둠
      isPublic = false;
      moderation_state = "deleted";
      moderation_reason = mod.reason ?? "policy_sensitive";
      deleted_at = new Date().toISOString();
      deleted_by = "ai";
    }
  }

  const rawKind = (body.resonanceKind ?? "").trim();
  const resonance_kind = rawKind && isResonanceKindId(rawKind) ? rawKind : null;

  const insertPayload = {
    nickname,
    note: noteSliced,
    duration_type: durationType,
    resonance_kind,
    is_public: isPublic,
    moderation_state,
    moderation_reason,
    deleted_at,
    deleted_by,
  };

  const { error } = await admin.from("awakenings").insert(insertPayload as never);
  if (error) {
    return NextResponse.json({ ok: false, error: "저장에 실패했습니다." }, { status: 500 });
  }

  // 프로필은 선택 입력
  const gender = body.gender ?? null;
  const ageGroup = body.ageGroup ?? null;
  if (gender != null || ageGroup != null) {
    try {
      await admin
        .from("participant_profiles")
        .upsert(
          { nickname, gender, age_group: ageGroup, updated_at: new Date().toISOString() } as never,
          { onConflict: "nickname" }
        );
    } catch {
      // ignore
    }
  }

  // 사용자에게는 "키/정책" 원인 노출 없이 중립 안내만 제공
  const notice =
    isPublicRequested && moderation_state !== "ok"
      ? "일시적 점검으로 공유저장이 제한되어 보관 처리되었습니다."
      : null;

  return NextResponse.json({
    ok: true,
    isPublicSaved: isPublic,
    moderationState: moderation_state,
    notice,
  });
}

