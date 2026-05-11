import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { PREMIUM_REPORT_PRODUCT_CODE } from "@/lib/premiumReport";

export async function GET() {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });

  const { data, error } = await admin
    .from("premium_report_products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as {
    code?: string;
    name?: string;
    description?: string | null;
    defaultPages?: number;
    sections?: unknown[];
    active?: boolean;
  };

  const code = (body.code ?? PREMIUM_REPORT_PRODUCT_CODE).trim();
  const name = (body.name ?? "나의 자깨 감응 보고서").trim();
  const defaultPages = Math.max(1, Math.min(50, Number(body.defaultPages ?? 4) || 4));
  const sections = Array.isArray(body.sections) ? body.sections : [];

  if (!code || !name) {
    return NextResponse.json({ error: "code와 name이 필요합니다." }, { status: 400 });
  }

  const { error } = await admin.from("premium_report_products").upsert(
    {
      code,
      name,
      description: body.description ?? null,
      default_pages: defaultPages,
      sections_json: sections,
      active: body.active !== false,
    } as never,
    { onConflict: "code" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
