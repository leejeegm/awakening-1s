import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getClientIp } from "@/lib/requestIp";
import { sha256Hex } from "@/lib/secureCompare";
import {
  clearParticipantVerifyFailures,
  isParticipantVerifyLocked,
  recordParticipantVerifyFailure,
} from "@/lib/participantVerifyRateLimit";
import type { Database } from "@/types/supabase";

type AwakeningRow = Database["public"]["Tables"]["awakenings"]["Row"];

/**
 * 내 기록 조회: 비밀번호 검증 또는 최초 등록 후 기록 목록 반환.
 * participant_keys는 서버(service role)에서만 접근.
 */
export async function POST(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "서버 설정 오류" }, { status: 503 });
  }

  let body: {
    nickname?: string;
    password?: string;
    passwordConfirm?: string;
    hint?: string;
    /** all=전체, private=나만보기, public=내글공개 */
    scope?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "요청 형식 오류" }, { status: 400 });
  }

  const nickname = (body.nickname ?? "").trim().slice(0, 20);
  const password = (body.password ?? "").trim();
  const passwordConfirm = (body.passwordConfirm ?? "").trim();
  const hint = (body.hint ?? "").trim().slice(0, 100);
  const scopeRaw = (body.scope ?? "all").trim().toLowerCase();
  const scope =
    scopeRaw === "private" || scopeRaw === "public" ? scopeRaw : ("all" as const);

  if (!nickname || !password) {
    return NextResponse.json({ ok: false, error: "닉네임과 비밀번호를 모두 입력해 주세요." }, { status: 400 });
  }

  const ip = getClientIp(request);
  if (isParticipantVerifyLocked(ip, nickname)) {
    return NextResponse.json(
      { ok: false, error: "시도 횟수가 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429 }
    );
  }

  const hash = sha256Hex(password);

  const { data: keyRow, error: keyError } = await admin
    .from("participant_keys")
    .select("password_hash, password_hint")
    .eq("nickname", nickname)
    .maybeSingle();

  if (keyError) {
    return NextResponse.json({ ok: false, error: "확인에 실패했습니다." }, { status: 500 });
  }

  if (!keyRow) {
    if (password !== passwordConfirm) {
      return NextResponse.json(
        { ok: false, error: "비밀번호와 비밀번호 확인이 일치하지 않습니다." },
        { status: 400 }
      );
    }
    const { error: insertError } = await admin.from("participant_keys").insert({
      nickname,
      password_hash: hash,
      password_hint: hint || null,
    } as never);
    if (insertError) {
      return NextResponse.json({ ok: false, error: "등록에 실패했습니다." }, { status: 500 });
    }
  } else {
    const stored = (keyRow as { password_hash?: string | null }).password_hash?.trim().toLowerCase();
    if (!stored || stored !== hash) {
      recordParticipantVerifyFailure(ip, nickname);
      const passwordHint = (keyRow as { password_hint?: string | null }).password_hint;
      return NextResponse.json(
        {
          ok: false,
          error: passwordHint
            ? `비밀번호가 일치하지 않습니다. 힌트: ${passwordHint}`
            : "비밀번호가 일치하지 않습니다. 처음 조회 시 입력한 비밀번호를 사용해 주세요.",
        },
        { status: 401 }
      );
    }
  }

  clearParticipantVerifyFailures(ip, nickname);

  let recordsQuery = admin
    .from("awakenings")
    .select("*")
    .eq("nickname", nickname)
    .eq("moderation_state", "ok");
  if (scope === "private") {
    recordsQuery = recordsQuery.eq("is_public", false);
  } else if (scope === "public") {
    recordsQuery = recordsQuery.eq("is_public", true);
  }
  const { data: records, error: recError } = await recordsQuery.order("created_at", {
    ascending: false,
  });

  if (recError) {
    return NextResponse.json({ ok: false, error: recError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    authHash: hash,
    scope,
    items: (records ?? []) as AwakeningRow[],
  });
}
