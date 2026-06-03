import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { isFeatureEnabledForNickname, normalizeNickname } from "@/lib/entitlements";

export type ImageEntitlementFeatureKey = "image_cut" | "comic_4panel";

export const IMAGE_ENTITLEMENT_FEATURES: ImageEntitlementFeatureKey[] = ["image_cut", "comic_4panel"];

export type ImageEntitlementRequestStatus = "pending" | "approved" | "rejected" | "cancelled";
export type ImageEntitlementPaymentStatus = "unpaid" | "paid" | "waived";

export type ImageEntitlementRequestRow = {
  id: string;
  nickname: string;
  feature_key: ImageEntitlementFeatureKey;
  status: ImageEntitlementRequestStatus;
  payment_status: ImageEntitlementPaymentStatus;
  requested_at: string;
  payment_confirmed_at: string | null;
  payment_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

export function parseImageEntitlementFeatures(raw: unknown): ImageEntitlementFeatureKey[] {
  if (raw === "both" || raw === "all") return [...IMAGE_ENTITLEMENT_FEATURES];
  if (typeof raw === "string" && IMAGE_ENTITLEMENT_FEATURES.includes(raw as ImageEntitlementFeatureKey)) {
    return [raw as ImageEntitlementFeatureKey];
  }
  if (Array.isArray(raw)) {
    return raw.filter((k): k is ImageEntitlementFeatureKey =>
      typeof k === "string" && IMAGE_ENTITLEMENT_FEATURES.includes(k as ImageEntitlementFeatureKey)
    );
  }
  return ["image_cut"];
}

export async function grantImageEntitlement(
  admin: SupabaseClient<Database>,
  args: {
    nickname: string;
    featureKey: ImageEntitlementFeatureKey;
    source: string;
    enabledBy: string;
    expiresAt?: string | null;
  }
): Promise<{ ok: boolean; error?: string }> {
  const nickname = normalizeNickname(args.nickname);
  const { error } = await admin.from("participant_entitlements").upsert(
    {
      nickname,
      feature_key: args.featureKey,
      enabled: true,
      source: args.source.slice(0, 30),
      enabled_by: args.enabledBy.slice(0, 60),
      expires_at: args.expiresAt ?? null,
    } as never,
    { onConflict: "nickname,feature_key" }
  );
  if (error) return { ok: false, error: error.message };

  try {
    await admin.from("admin_entitlement_actions").insert({
      nickname,
      feature_key: args.featureKey,
      enabled: true,
      expires_at: args.expiresAt ?? null,
      source: args.source.slice(0, 30),
      enabled_by: args.enabledBy.slice(0, 60),
    } as never);
  } catch {
    // ignore audit failure
  }
  return { ok: true };
}

export async function createImageEntitlementRequests(
  admin: SupabaseClient<Database>,
  nickname: string,
  featureKeys: ImageEntitlementFeatureKey[]
): Promise<{ created: ImageEntitlementFeatureKey[]; skipped: { feature: ImageEntitlementFeatureKey; reason: string }[] }> {
  const n = normalizeNickname(nickname);
  const created: ImageEntitlementFeatureKey[] = [];
  const skipped: { feature: ImageEntitlementFeatureKey; reason: string }[] = [];

  for (const featureKey of featureKeys) {
    const enabled = await isFeatureEnabledForNickname(n, featureKey);
    if (enabled.ok) {
      skipped.push({ feature: featureKey, reason: "already_enabled" });
      continue;
    }

    const { data: pending } = await admin
      .from("image_entitlement_requests")
      .select("id")
      .eq("nickname", n)
      .eq("feature_key", featureKey)
      .eq("status", "pending")
      .maybeSingle();

    if (pending) {
      skipped.push({ feature: featureKey, reason: "already_pending" });
      continue;
    }

    const { error } = await admin.from("image_entitlement_requests").insert({
      nickname: n,
      feature_key: featureKey,
      status: "pending",
      payment_status: "unpaid",
    } as never);

    if (error) {
      skipped.push({ feature: featureKey, reason: error.message.slice(0, 120) });
      continue;
    }
    created.push(featureKey);
  }

  return { created, skipped };
}

export async function listImageEntitlementRequestsForNickname(
  admin: SupabaseClient<Database>,
  nickname: string,
  limit = 10
): Promise<ImageEntitlementRequestRow[]> {
  const n = normalizeNickname(nickname);
  const { data } = await admin
    .from("image_entitlement_requests")
    .select("*")
    .eq("nickname", n)
    .order("requested_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ImageEntitlementRequestRow[];
}
