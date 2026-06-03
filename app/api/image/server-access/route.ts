import { NextRequest, NextResponse } from "next/server";
import { verifyParticipantAuthHash } from "@/lib/participantAuth";
import { normalizeNickname } from "@/lib/entitlements";
import { isFeatureEnabledForNickname } from "@/lib/entitlements";
import { getServerImageUsageSnapshot } from "@/lib/imageLimits";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawNick = (searchParams.get("nickname") ?? "").trim().slice(0, 20);
  const nickname = normalizeNickname(rawNick);
  const authHash = (searchParams.get("authHash") ?? "").trim();

  if (!rawNick || !nickname) {
    return NextResponse.json({ ok: false, error: "닉네임이 필요합니다." }, { status: 400 });
  }
  if (!authHash) {
    return NextResponse.json(
      { ok: false, error: "인증이 필요합니다.", requiresAuth: true },
      { status: 401 }
    );
  }

  const ok = await verifyParticipantAuthHash(rawNick, authHash);
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: "인증에 실패했습니다.", requiresAuth: true },
      { status: 401 }
    );
  }

  const imageCut = await isFeatureEnabledForNickname(nickname, "image_cut");
  const comic4 = await isFeatureEnabledForNickname(nickname, "comic_4panel");
  const usage = await getServerImageUsageSnapshot({ nickname });

  let pendingRequests: unknown[] = [];
  const admin = getSupabaseAdmin();
  if (admin) {
    try {
      const { data } = await admin
        .from("image_entitlement_requests")
        .select("id, feature_key, status, payment_status, requested_at")
        .eq("nickname", nickname)
        .eq("status", "pending")
        .order("requested_at", { ascending: false });
      pendingRequests = data ?? [];
    } catch {
      pendingRequests = [];
    }
  }
  return NextResponse.json({
    ok: true,
    nickname,
    features: {
      image_cut: imageCut.ok,
      comic_4panel: comic4.ok,
    },
    featureReasons: {
      image_cut: imageCut.ok ? null : imageCut.reason,
      comic_4panel: comic4.ok ? null : comic4.reason,
    },
    pendingRequests,
    usage: usage.ok ? usage : null,
    usageError: usage.ok ? null : usage.message,
  });
}

