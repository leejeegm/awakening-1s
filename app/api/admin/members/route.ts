import { NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/** 회원(participant_keys) 목록 — 비밀번호 해시는 제외, 닉네임·힌트만 */
export async function GET() {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });
  }
  const { data, error } = await admin
    .from("participant_keys")
    .select("nickname, password_hint")
    .order("nickname");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const nicknames = (data ?? []).map((r) => String(r.nickname).trim().toLowerCase()).filter(Boolean);
  const { data: entData } = await admin
    .from("participant_entitlements")
    .select("nickname, feature_key, enabled, expires_at")
    .in("nickname", nicknames as unknown as string[])
    .in("feature_key", ["image_cut", "comic_4panel"]);

  const now = new Date();
  const entMap = new Map<string, { image_cut: boolean; comic_4panel: boolean }>();
  for (const n of nicknames) entMap.set(n, { image_cut: false, comic_4panel: false });
  for (const row of (entData ?? []) as { nickname: string; feature_key: string; enabled: boolean; expires_at: string | null }[]) {
    const n = String(row.nickname ?? "").trim().toLowerCase();
    if (!entMap.has(n)) entMap.set(n, { image_cut: false, comic_4panel: false });
    const valid = row.enabled && (!row.expires_at || new Date(row.expires_at) > now);
    if (row.feature_key === "image_cut") entMap.get(n)!.image_cut = valid;
    if (row.feature_key === "comic_4panel") entMap.get(n)!.comic_4panel = valid;
  }

  return NextResponse.json({
    data: (data ?? []).map((m) => ({
      ...m,
      entitlements: entMap.get(String(m.nickname).trim().toLowerCase()) ?? { image_cut: false, comic_4panel: false },
    })),
  });
}
