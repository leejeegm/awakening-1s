import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { moderateForPublicShare } from "@/lib/moderation";
import { getClientIp } from "@/lib/requestIp";
import { inferResonanceKindFromNote } from "@/lib/inferResonanceKind";
import {
  isResonanceKindId,
  RESONANCE_KIND_NONE,
  resonanceKindShortLabel,
  resolveResonanceKindForDb,
} from "@/lib/resonanceEssence";

type Body = {
  nickname?: string;
  note?: string;
  durationType?: "1s" | "10s" | "100s";
  resonanceKind?: string | null;
  gender?: "male" | "female" | "defer" | null;
  ageGroup?: string | null;
  isPublic?: boolean;
};

type AwakeningInsertRow = {
  nickname: string;
  note: string;
  duration_type: string;
  resonance_kind: string;
  is_public: boolean;
  moderation_state: "ok" | "deleted";
  moderation_reason: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
};

function isMissingColumn(message: string, column: string, code?: string): boolean {
  const m = message.toLowerCase();
  const col = column.toLowerCase();
  if (m.includes(col)) return true;
  if (code === "PGRST204" && m.includes("resonance")) return true;
  return (
    (m.includes("column") && m.includes("does not exist")) ||
    m.includes("schema cache") ||
    m.includes("could not find")
  );
}

/** migration 026 미적용 DB에서도 기록 저장 가능 */
async function insertAwakeningRow(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  row: AwakeningInsertRow
) {
  const first = await admin.from("awakenings").insert(row as never).select("id").single();
  if (!first.error && first.data?.id) {
    return { ok: true as const, id: first.data.id as string };
  }

  if ("resonance_kind" in row && isMissingColumn(first.error?.message ?? "", "resonance_kind", first.error?.code)) {
    const { resonance_kind: _omit, ...withoutKind } = row;
    const retry = await admin.from("awakenings").insert(withoutKind as never).select("id").single();
    if (!retry.error && retry.data?.id) {
      return { ok: true as const, id: retry.data.id as string, resonanceKindSkipped: true as const };
    }
    return { ok: false as const, error: retry.error! };
  }

  return { ok: false as const, error: first.error! };
}

async function attachAiResonanceKind(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  awakeningId: string,
  aiKind: string
) {
  const upd = await admin
    .from("awakenings")
    .update({ resonance_kind_ai: aiKind } as never)
    .eq("id", awakeningId);
  if (!upd.error) return true;
  if (isMissingColumn(upd.error.message, "resonance_kind_ai", upd.error.code)) return false;
  console.warn("[awakenings/ai-kind]", upd.error.message);
  return false;
}

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
  const userPickedKind = rawKind && isResonanceKindId(rawKind);
  const resonance_kind = userPickedKind ? rawKind : resolveResonanceKindForDb(body.resonanceKind);

  const insertPayload: AwakeningInsertRow = {
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

  const inserted = await insertAwakeningRow(admin, insertPayload);
  let resonanceKindAi: string | null = null;

  if (
    inserted.ok &&
    inserted.id &&
    !userPickedKind &&
    resonance_kind === RESONANCE_KIND_NONE &&
    !inserted.resonanceKindSkipped
  ) {
    const inferred = await inferResonanceKindFromNote(noteSliced, durationType, {
      rateLimitKey: nickname,
    });
    if (inferred) {
      const attached = await attachAiResonanceKind(admin, inserted.id, inferred);
      if (attached) resonanceKindAi = inferred;
    }
  }

  if (!inserted.ok) {
    console.error("[awakenings/insert]", inserted.error.message, inserted.error.code);
    return NextResponse.json(
      {
        ok: false,
        error:
          process.env.NODE_ENV === "development"
            ? `저장에 실패했습니다. (${inserted.error.message})`
            : "저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 500 }
    );
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

  let totalRecords: number | null = null;
  let myRecordCount: number | null = null;
  if (moderation_state === "ok") {
    const [{ count: totalCount }, { count: nickCount }] = await Promise.all([
      admin
        .from("awakenings")
        .select("*", { count: "exact", head: true })
        .eq("moderation_state", "ok"),
      admin
        .from("awakenings")
        .select("*", { count: "exact", head: true })
        .eq("moderation_state", "ok")
        .eq("nickname", nickname),
    ]);
    totalRecords = typeof totalCount === "number" ? totalCount : null;
    myRecordCount = typeof nickCount === "number" ? nickCount : null;
  }

  return NextResponse.json({
    ok: true,
    isPublicSaved: isPublic,
    moderationState: moderation_state,
    notice,
    resonanceKindAi,
    resonanceKindAiLabel:
      resonanceKindAi && isResonanceKindId(resonanceKindAi)
        ? resonanceKindShortLabel(resonanceKindAi)
        : null,
    totalRecords,
    myRecordCount,
  });
}

