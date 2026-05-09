import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { FeatureKey } from "@/lib/entitlements";
import { normalizeNickname } from "@/lib/entitlements";

const FEATURES: FeatureKey[] = ["image_cut", "comic_4panel"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nickname = normalizeNickname(searchParams.get("nickname") ?? "");
  if (!nickname) {
    return NextResponse.json({ error: "닉네임이 필요합니다." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "DB 연결을 사용할 수 없습니다." }, { status: 503 });
  }

  const { data, error } = await admin
    .from("participant_entitlements")
    .select("feature_key, enabled, expires_at")
    .eq("nickname", nickname)
    .in("feature_key", FEATURES as unknown as string[]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date();
  const enabled = new Set(
    (data ?? [])
      .filter((r) => r.enabled && (!r.expires_at || new Date(r.expires_at) > now))
      .map((r) => r.feature_key)
  );

  return NextResponse.json({
    nickname,
    features: FEATURES.reduce<Record<string, boolean>>((acc, k) => {
      acc[k] = enabled.has(k);
      return acc;
    }, {}),
  });
}

