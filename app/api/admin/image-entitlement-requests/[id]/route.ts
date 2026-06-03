import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { ImageEntitlementFeatureKey, ImageEntitlementRequestRow } from "@/lib/imageEntitlementRequests";
import {
  grantImageEntitlement,
  IMAGE_ENTITLEMENT_FEATURES,
} from "@/lib/imageEntitlementRequests";
import { hintFromPgError } from "@/lib/pgErrorHints";

type AdminAction = "mark_paid" | "mark_unpaid" | "waive_payment" | "approve" | "reject";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });
  }

  const id = (params.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  }

  let body: {
    action?: AdminAction;
    admin_note?: string;
    payment_note?: string;
    expires_at?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const action = body.action;
  const validActions: AdminAction[] = [
    "mark_paid",
    "mark_unpaid",
    "waive_payment",
    "approve",
    "reject",
  ];
  if (!action || !validActions.includes(action)) {
    return NextResponse.json({ error: "action이 올바르지 않습니다." }, { status: 400 });
  }

  const { data: row, error: fetchErr } = await admin
    .from("image_entitlement_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ error: fetchErr?.message ?? "요청을 찾을 수 없습니다." }, { status: 404 });
  }

  const req = row as ImageEntitlementRequestRow;
  const now = new Date().toISOString();
  const adminNote = (body.admin_note ?? "").trim().slice(0, 500) || null;
  const paymentNote = (body.payment_note ?? "").trim().slice(0, 500) || null;

  if (action === "mark_paid") {
    const { error } = await admin
      .from("image_entitlement_requests")
      .update({
        payment_status: "paid",
        payment_confirmed_at: now,
        payment_note: paymentNote ?? req.payment_note,
        admin_note: adminNote ?? req.admin_note,
      } as never)
      .eq("id", id);
    if (error) {
      const hint = hintFromPgError(error.message, error.code);
      return NextResponse.json({ error: error.message, ...(hint ? { hint } : {}) }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "mark_unpaid") {
    const { error } = await admin
      .from("image_entitlement_requests")
      .update({
        payment_status: "unpaid",
        payment_confirmed_at: null,
        admin_note: adminNote ?? req.admin_note,
      } as never)
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "waive_payment") {
    const { error } = await admin
      .from("image_entitlement_requests")
      .update({
        payment_status: "waived",
        payment_confirmed_at: now,
        payment_note: paymentNote ?? "면제",
        admin_note: adminNote ?? req.admin_note,
      } as never)
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "reject") {
    if (req.status !== "pending") {
      return NextResponse.json({ error: "대기 중인 요청만 거절할 수 있습니다." }, { status: 400 });
    }
    const { error } = await admin
      .from("image_entitlement_requests")
      .update({
        status: "rejected",
        reviewed_at: now,
        reviewed_by: "admin",
        admin_note: adminNote,
      } as never)
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "approve") {
    if (req.status !== "pending") {
      return NextResponse.json({ error: "대기 중인 요청만 승인할 수 있습니다." }, { status: 400 });
    }
    if (req.payment_status === "unpaid") {
      return NextResponse.json(
        { error: "결제 확인(또는 결제 면제) 후 승인해 주세요." },
        { status: 400 }
      );
    }

    const featureKey = req.feature_key as ImageEntitlementFeatureKey;
    if (!IMAGE_ENTITLEMENT_FEATURES.includes(featureKey)) {
      return NextResponse.json({ error: "feature_key가 올바르지 않습니다." }, { status: 400 });
    }

    const expiresAt = body.expires_at ? String(body.expires_at) : null;
    const granted = await grantImageEntitlement(admin, {
      nickname: req.nickname,
      featureKey,
      source: "request_approval",
      enabledBy: "admin",
      expiresAt,
    });
    if (!granted.ok) {
      return NextResponse.json({ error: granted.error ?? "승인 반영 실패" }, { status: 500 });
    }

    const { error } = await admin
      .from("image_entitlement_requests")
      .update({
        status: "approved",
        reviewed_at: now,
        reviewed_by: "admin",
        admin_note: adminNote,
      } as never)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "처리할 수 없습니다." }, { status: 400 });
}
