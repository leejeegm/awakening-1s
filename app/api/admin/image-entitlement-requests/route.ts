import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { ImageEntitlementRequestRow } from "@/lib/imageEntitlementRequests";
import { hintFromPgError } from "@/lib/pgErrorHints";

export async function GET(request: NextRequest) {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get("status") ?? "pending").trim();
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") ?? "50", 10)));

  let q = admin
    .from("image_entitlement_requests")
    .select("*")
    .order("requested_at", { ascending: false })
    .limit(limit);

  if (status && status !== "all") {
    q = q.eq("status", status as "pending" | "approved" | "rejected" | "cancelled");
  }

  const { data, error } = await q;
  if (error) {
    const hint = hintFromPgError(error.message, error.code);
    return NextResponse.json({ error: error.message, ...(hint ? { hint } : {}) }, { status: 500 });
  }

  return NextResponse.json({ items: (data ?? []) as ImageEntitlementRequestRow[] });
}
