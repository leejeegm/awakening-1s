import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { Database } from "@/types/supabase";

type ParticipantEntitlementGateRow = Pick<
  Database["public"]["Tables"]["participant_entitlements"]["Row"],
  "enabled" | "expires_at"
>;

export type FeatureKey = "image_cut" | "comic_4panel";

export function normalizeNickname(nickname: string) {
  return (nickname ?? "").trim().toLowerCase();
}

export async function isFeatureEnabledForNickname(nickname: string, featureKey: FeatureKey) {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, reason: "db_unavailable" as const };
  const n = normalizeNickname(nickname);
  if (!n) return { ok: false, reason: "missing_nickname" as const };

  const { data, error } = await admin
    .from("participant_entitlements")
    .select("enabled, expires_at")
    .eq("nickname", n)
    .eq("feature_key", featureKey)
    .maybeSingle();

  if (error) return { ok: false, reason: "db_error" as const };
  const row = data as ParticipantEntitlementGateRow | null;
  if (!row?.enabled) return { ok: false, reason: "not_enabled" as const };
  if (row.expires_at && new Date(row.expires_at) <= new Date()) {
    return { ok: false, reason: "expired" as const };
  }
  return { ok: true as const };
}

