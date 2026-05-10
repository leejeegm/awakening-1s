import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { FeatureKey } from "@/lib/entitlements";
import { normalizeNickname } from "@/lib/entitlements";
import { hintFromPgError } from "@/lib/pgErrorHints";

const FEATURES: FeatureKey[] = ["image_cut", "comic_4panel"];

export async function GET(request: NextRequest) {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const nickname = normalizeNickname(searchParams.get("nickname") ?? "");
  if (!nickname) return NextResponse.json({ error: "닉네임이 필요합니다." }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });

  const { data, error } = await admin
    .from("participant_entitlements")
    .select("feature_key, enabled, source, enabled_by, expires_at, updated_at")
    .eq("nickname", nickname)
    .in("feature_key", FEATURES as unknown as string[]);
  if (error) {
    const hint = hintFromPgError(error.message, error.code);
    return NextResponse.json({ error: error.message, ...(hint ? { hint } : {}) }, { status: 500 });
  }
  return NextResponse.json({ nickname, rows: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });

  let body: {
    nickname?: string;
    feature_key?: FeatureKey;
    enabled?: boolean;
    source?: string | null;
    enabled_by?: string | null;
    expires_at?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const nickname = normalizeNickname(body.nickname ?? "");
  const featureKey = body.feature_key;
  if (!nickname) return NextResponse.json({ error: "닉네임이 필요합니다." }, { status: 400 });
  if (!featureKey || !FEATURES.includes(featureKey)) {
    return NextResponse.json({ error: "feature_key가 올바르지 않습니다." }, { status: 400 });
  }

  const enabled = !!body.enabled;
  const source = (body.source ?? "admin")?.slice(0, 30) ?? null;
  const enabledBy = (body.enabled_by ?? "admin")?.slice(0, 60) ?? null;
  const expiresAt = body.expires_at ? String(body.expires_at) : null;

  const { error } = await admin.from("participant_entitlements").upsert(
    {
      nickname,
      feature_key: featureKey,
      enabled,
      source,
      enabled_by: enabledBy,
      expires_at: expiresAt,
    } as never,
    { onConflict: "nickname,feature_key" }
  );
  if (error) {
    const hint = hintFromPgError(error.message, error.code);
    return NextResponse.json({ error: error.message, ...(hint ? { hint } : {}) }, { status: 500 });
  }

  // 감사 로그(승인/해제) 저장 (실패해도 본 작업은 성공 처리)
  try {
    await admin.from("admin_entitlement_actions").insert({
      nickname,
      feature_key: featureKey,
      enabled,
      expires_at: expiresAt,
      source,
      enabled_by: enabledBy,
    } as never);
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true });
}

