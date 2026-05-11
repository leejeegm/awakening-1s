import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyParticipantAuthHash } from "@/lib/participantAuth";
import { normalizeNickname } from "@/lib/entitlements";
import { PREMIUM_REPORT_PRODUCT_CODE } from "@/lib/premiumReport";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawNickname = (searchParams.get("nickname") ?? "").trim().slice(0, 20);
  const nickname = normalizeNickname(rawNickname);
  const authHash = (searchParams.get("authHash") ?? "").trim();

  if (!nickname || !rawNickname) {
    return NextResponse.json({ error: "닉네임이 필요합니다." }, { status: 400 });
  }
  if (!authHash) {
    return NextResponse.json({ error: "인증이 필요합니다.", requiresAuth: true }, { status: 401 });
  }

  const ok = await verifyParticipantAuthHash(rawNickname, authHash);
  if (!ok) {
    return NextResponse.json({ error: "인증에 실패했습니다.", requiresAuth: true }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "DB 연결을 사용할 수 없습니다." }, { status: 503 });
  }

  const { data, error } = await admin
    .from("premium_report_requests")
    .select("id, status, payment_status, downloadable, requested_at, updated_at, product_id")
    .eq("nickname", nickname)
    .order("requested_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "DB 연결을 사용할 수 없습니다." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    nickname?: string;
    authHash?: string;
    productCode?: string;
    consent?: boolean;
  };

  const rawNickname = (body.nickname ?? "").trim().slice(0, 20);
  const nickname = normalizeNickname(rawNickname);
  const authHash = (body.authHash ?? "").trim();
  const productCode = String(body.productCode ?? PREMIUM_REPORT_PRODUCT_CODE);
  const consent = body.consent === true;

  if (!nickname || !rawNickname || !authHash || !consent) {
    return NextResponse.json({ error: "nickname, authHash, consent가 필요합니다." }, { status: 400 });
  }

  const ok = await verifyParticipantAuthHash(rawNickname, authHash);
  if (!ok) {
    return NextResponse.json({ error: "인증에 실패했습니다.", requiresAuth: true }, { status: 401 });
  }

  const { data: eligibility } = await admin
    .from("premium_report_eligibility_snapshots")
    .select("qualifies")
    .eq("nickname", nickname)
    .maybeSingle();

  if (!(eligibility as { qualifies?: boolean } | null)?.qualifies) {
    return NextResponse.json({ error: "아직 신청 조건을 충족하지 않았습니다." }, { status: 403 });
  }

  const { data: product } = await admin
    .from("premium_report_products")
    .select("id, code, name")
    .eq("code", productCode)
    .eq("active", true)
    .maybeSingle();

  if (!product) {
    return NextResponse.json({ error: "유효한 상품이 아닙니다." }, { status: 400 });
  }

  const { data: existing } = await admin
    .from("premium_report_requests")
    .select("id, status, payment_status, downloadable")
    .eq("nickname", nickname)
    .in("status", ["requested", "paid_pending", "approved", "in_progress", "ready"] as never)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      ok: true,
      requestId: (existing as { id: string }).id,
      status: (existing as { status: string }).status,
      paymentStatus: (existing as { payment_status: string }).payment_status,
      alreadyExists: true,
    });
  }

  const { data: inserted, error } = await admin
    .from("premium_report_requests")
    .insert({
      nickname,
      product_id: (product as { id: string }).id,
      status: "requested",
      payment_status: "pending_manual_check",
    } as never)
    .select("id, status, payment_status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.from("premium_report_actions").insert({
    request_id: (inserted as { id: string }).id,
    action: "requested",
    actor: nickname,
    meta_json: {
      productCode,
      productName: (product as { name: string }).name,
    },
  } as never);

  return NextResponse.json({
    ok: true,
    requestId: (inserted as { id: string }).id,
    status: (inserted as { status: string }).status,
    paymentStatus: (inserted as { payment_status: string }).payment_status,
  });
}
