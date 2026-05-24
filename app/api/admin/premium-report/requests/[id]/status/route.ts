import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const PREMIUM_STATUSES = new Set([
  "requested",
  "paid_pending",
  "approved",
  "in_progress",
  "ready",
  "rejected",
  "expired",
]);

const PREMIUM_PAYMENT_STATUSES = new Set([
  "unpaid",
  "pending_manual_check",
  "confirmed",
  "failed",
  "refunded",
]);

const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  requested: ["approved", "rejected", "expired"],
  paid_pending: ["approved", "rejected", "expired"],
  approved: ["in_progress", "rejected", "expired"],
  in_progress: ["ready", "rejected", "expired"],
  ready: ["ready", "expired"],
  rejected: ["rejected"],
  expired: ["expired"],
};

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as {
    status?: string;
    paymentStatus?: string;
    adminNote?: string | null;
    downloadable?: boolean;
  };

  const { data: current, error: currentError } = await admin
    .from("premium_report_requests")
    .select(
      "id, nickname, status, payment_status, admin_note, downloadable, downloadable_at, approved_at, approved_by"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (currentError || !current) {
    return NextResponse.json({ error: "신청을 찾을 수 없습니다." }, { status: 404 });
  }

  if (body.status != null && !PREMIUM_STATUSES.has(body.status)) {
    return NextResponse.json({ error: "유효하지 않은 상태값입니다." }, { status: 400 });
  }
  if (body.paymentStatus != null && !PREMIUM_PAYMENT_STATUSES.has(body.paymentStatus)) {
    return NextResponse.json({ error: "유효하지 않은 결제 상태값입니다." }, { status: 400 });
  }

  const currentRow = current as {
    nickname: string;
    status: string;
    payment_status: string;
    admin_note: string | null;
    downloadable: boolean;
    downloadable_at: string | null;
    approved_at: string | null;
    approved_by: string | null;
  };

  const hasAdminNotePatch = Object.prototype.hasOwnProperty.call(body, "adminNote");
  const hasDownloadablePatch = typeof body.downloadable === "boolean";

  const nextStatus = body.status ?? currentRow.status;
  const nextPaymentStatus = body.paymentStatus ?? currentRow.payment_status;
  const nextAdminNote = hasAdminNotePatch ? body.adminNote ?? null : currentRow.admin_note;
  const isStatusChanging = body.status != null && body.status !== currentRow.status;

  if (isStatusChanging) {
    const allowedStatuses = ALLOWED_STATUS_TRANSITIONS[currentRow.status] ?? [];
    if (!allowedStatuses.includes(body.status!)) {
      return NextResponse.json(
        { error: `현재 상태(${currentRow.status})에서는 ${body.status}로 변경할 수 없습니다.` },
        { status: 400 }
      );
    }
  }

  if (nextStatus === "approved" && nextPaymentStatus !== "confirmed") {
    return NextResponse.json({ error: "결제 확인 후에만 승인할 수 있습니다." }, { status: 400 });
  }

  const requiresApproval = nextStatus === "in_progress" || nextStatus === "ready";
  if (requiresApproval && !currentRow.approved_at) {
    return NextResponse.json({ error: "승인 완료 후에만 작성 시작 또는 배포 준비가 가능합니다." }, { status: 400 });
  }

  const shouldReleaseDownload = body.downloadable === true || nextStatus === "ready";
  let latestDocument:
    | {
        id: string;
        pdf_status: string;
      }
    | null = null;
  let hasFinalPdfAsset = false;

  if (shouldReleaseDownload) {
    const [{ data: doc }, { data: finalPdf }] = await Promise.all([
      admin
        .from("premium_report_documents")
        .select("id, pdf_status")
        .eq("request_id", params.id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("premium_report_assets")
        .select("id")
        .eq("request_id", params.id)
        .eq("asset_type", "final_pdf")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    latestDocument = (doc as { id: string; pdf_status: string } | null) ?? null;
    hasFinalPdfAsset = !!finalPdf;
  }

  if (nextStatus === "ready") {
    if (nextPaymentStatus !== "confirmed") {
      return NextResponse.json({ error: "결제 확인 후에만 ready 상태로 변경할 수 있습니다." }, { status: 400 });
    }
    if (!latestDocument) {
      return NextResponse.json({ error: "문서를 먼저 저장하거나 발행해야 ready 상태로 변경할 수 있습니다." }, { status: 400 });
    }
    if (latestDocument.pdf_status !== "ready" || !hasFinalPdfAsset) {
      return NextResponse.json({ error: "최종 PDF 발행 후에만 ready 상태로 변경할 수 있습니다." }, { status: 400 });
    }
  }

  let nextDownloadable = hasDownloadablePatch ? body.downloadable === true : currentRow.downloadable;
  if (nextStatus === "rejected" || nextStatus === "expired") {
    nextDownloadable = false;
  }

  if (body.downloadable === true) {
    if (nextStatus !== "ready") {
      return NextResponse.json({ error: "다운로드 허용은 ready 상태에서만 가능합니다." }, { status: 400 });
    }
    if (!latestDocument || latestDocument.pdf_status !== "ready" || !hasFinalPdfAsset) {
      return NextResponse.json({ error: "최종 PDF 발행 후에만 다운로드를 허용할 수 있습니다." }, { status: 400 });
    }
  }

  let nextDownloadableAt = currentRow.downloadable_at;
  if (nextStatus === "rejected" || nextStatus === "expired") {
    nextDownloadableAt = null;
  } else if (hasDownloadablePatch) {
    if (body.downloadable === true && !currentRow.downloadable) {
      nextDownloadableAt = new Date().toISOString();
    } else if (body.downloadable === false) {
      nextDownloadableAt = null;
    }
  }

  let nextApprovedAt = currentRow.approved_at;
  let nextApprovedBy = currentRow.approved_by;
  if (body.status === "approved" && !currentRow.approved_at) {
    nextApprovedAt = new Date().toISOString();
    nextApprovedBy = "admin";
  }

  const patch = {
    status: nextStatus,
    payment_status: nextPaymentStatus,
    admin_note: nextAdminNote,
    downloadable: nextDownloadable,
    downloadable_at: nextDownloadableAt,
    approved_at: nextApprovedAt,
    approved_by: nextApprovedBy,
  };

  const { error } = await admin.rpc("apply_premium_report_status" as never, {
    p_request_id: params.id,
    p_status: patch.status,
    p_payment_status: patch.payment_status,
    p_admin_note: patch.admin_note,
    p_downloadable: patch.downloadable,
    p_downloadable_at: patch.downloadable_at,
    p_approved_at: patch.approved_at,
    p_approved_by: patch.approved_by,
    p_action_meta: patch,
  } as never);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
