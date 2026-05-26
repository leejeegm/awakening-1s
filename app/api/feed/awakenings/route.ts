import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createHash } from "crypto";

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * 실험 데이터 타임라인(전체/내)용 피드.
 * 기존 UX(실시간 목록/누적 비교)를 유지하기 위해 서버에서 읽어 내려줍니다.
 *
 * 기본: 최근 60개 (moderation_state='ok')
 * nickname 제공 시: 해당 닉네임 최근 100개
 */
export async function GET(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ items: [] }, { status: 200 });

  const { searchParams } = new URL(request.url);
  const nickname = (searchParams.get("nickname") ?? "").trim().slice(0, 20);
  const authHash = (searchParams.get("authHash") ?? "").trim().toLowerCase();
  const limit = nickname ? 100 : 60;

  const baseSelect = "id, created_at, nickname, note, duration_type, is_public";
  const fullSelect = `${baseSelect}, resonance_kind, resonance_kind_ai`;

  let authOk = false;
  if (nickname) {
    const { data: keyRow } = await admin
      .from("participant_keys")
      .select("password_hash")
      .eq("nickname", nickname)
      .maybeSingle() as { data: { password_hash: string } | null };
    authOk = !!keyRow?.password_hash && !!authHash && keyRow.password_hash === authHash;
  }

  const runFeedQuery = async (selectCols: string) => {
    let q = admin
      .from("awakenings")
      .select(selectCols)
      .eq("moderation_state", "ok")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!nickname) {
      q = q.eq("is_public", true);
    } else {
      q = q.eq("nickname", nickname);
      if (!authOk) q = q.eq("is_public", true);
    }
    return q;
  };

  let { data, error } = await runFeedQuery(fullSelect);
  if (error && /resonance_kind/i.test(error.message)) {
    ({ data, error } = await runFeedQuery(baseSelect));
  }
  if (error) return NextResponse.json({ items: [] }, { status: 200 });

  // 닉네임 노출 정책:
  // - 전체 공개 피드(익명): nickname은 항상 null로 내려줌
  // - 닉네임 피드(내 기록): nickname 유지(클라이언트에서 "내 기록" UI에서만 사용)
  if (!nickname) {
    const masked = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
      ...r,
      nickname: null,
    }));
    return NextResponse.json({ items: masked }, { status: 200 });
  }
  return NextResponse.json({ items: data ?? [] }, { status: 200 });
}

