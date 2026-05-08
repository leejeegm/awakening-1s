import { NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getModerationQuarantineDays } from "@/lib/moderationQuarantine";
import type { Database } from "@/types/supabase";

type AW = Database["public"]["Tables"]["awakenings"]["Row"];

export async function GET() {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });

  const days = getModerationQuarantineDays();
  const cutoffMs = Date.now() - days * 86400000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  const { data, error } = await admin
    .from("awakenings")
    .select(
      "id, created_at, nickname, note, is_public, moderation_state, moderation_reason, deleted_at, deleted_by, purge_hold"
    )
    .eq("moderation_state", "deleted")
    .order("deleted_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as AW[];

  const items = rows.map((r) => ({
    ...r,
    purgeEligible:
      !r.purge_hold && r.deleted_at != null && new Date(r.deleted_at).getTime() <= cutoffMs,
  }));

  return NextResponse.json({
    quarantineDays: days,
    purgeCutoffIso: cutoffIso,
    items,
  });
}
