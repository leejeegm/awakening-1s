import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeNickname } from "@/lib/entitlements";
import type { Database } from "@/types/supabase";

type PremiumStatus = Database["public"]["Tables"]["premium_report_requests"]["Row"]["status"];

function toPremiumStatus(value: string): PremiumStatus | null {
  if (
    value === "requested" ||
    value === "paid_pending" ||
    value === "approved" ||
    value === "in_progress" ||
    value === "ready" ||
    value === "rejected" ||
    value === "expired"
  ) {
    return value;
  }
  return null;
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const status = toPremiumStatus((searchParams.get("status") ?? "").trim());
  const nickname = normalizeNickname(searchParams.get("nickname") ?? "");

  let q = admin
    .from("premium_report_requests")
    .select("*")
    .order("requested_at", { ascending: false })
    .limit(100);

  if (status) q = q.eq("status", status);
  if (nickname) q = q.eq("nickname", nickname);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [] });
}
