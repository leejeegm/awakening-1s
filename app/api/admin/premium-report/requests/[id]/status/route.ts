import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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
    .select("id, nickname")
    .eq("id", params.id)
    .maybeSingle();

  if (currentError || !current) {
    return NextResponse.json({ error: "신청을 찾을 수 없습니다." }, { status: 404 });
  }

  const patch = {
    status: body.status ?? undefined,
    payment_status: body.paymentStatus ?? undefined,
    admin_note: body.adminNote ?? null,
    downloadable: body.downloadable === true,
    downloadable_at: body.downloadable === true ? new Date().toISOString() : null,
    approved_at: body.status === "approved" ? new Date().toISOString() : null,
    approved_by: body.status === "approved" ? "admin" : null,
  };

  const { error } = await admin
    .from("premium_report_requests")
    .update(patch as never)
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const nickname = (current as { nickname: string }).nickname;
  await admin.from("participant_entitlements").upsert(
    {
      nickname,
      feature_key: "premium_report_download",
      enabled: body.downloadable === true,
      source: "admin",
      enabled_by: "admin",
      expires_at: null,
    } as never,
    { onConflict: "nickname,feature_key" }
  );

  await admin.from("premium_report_actions").insert({
    request_id: params.id,
    action: "status_changed",
    actor: "admin",
    meta_json: patch,
  } as never);

  return NextResponse.json({ ok: true });
}
