import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getPremiumReportAssetMeta, sortPremiumReportAssets } from "@/lib/premiumReportStorage";

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
    assetIds?: string[];
  };
  const assetIds = Array.isArray(body.assetIds) ? body.assetIds.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];
  if (assetIds.length === 0) {
    return NextResponse.json({ error: "assetIds가 필요합니다." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("premium_report_assets")
    .select("id, asset_type, meta_json, created_at")
    .eq("request_id", params.id);

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "자산 조회 실패" }, { status: 500 });
  }

  const editableAssets = sortPremiumReportAssets(
    (data as { id: string; asset_type: string; meta_json: unknown; created_at: string }[]).filter(
      (item) => item.asset_type !== "final_pdf"
    )
  );
  const currentIds = editableAssets.map((item) => item.id);

  if (currentIds.length !== assetIds.length) {
    return NextResponse.json({ error: "정렬 대상 자산 수가 맞지 않습니다." }, { status: 400 });
  }

  const currentSet = new Set(currentIds);
  if (assetIds.some((id) => !currentSet.has(id)) || currentIds.some((id) => !assetIds.includes(id))) {
    return NextResponse.json({ error: "정렬 대상 자산 목록이 현재 상태와 다릅니다." }, { status: 400 });
  }

  for (let i = 0; i < assetIds.length; i++) {
    const id = assetIds[i];
    const current = editableAssets.find((item) => item.id === id);
    if (!current) continue;
    const nextMeta = {
      ...getPremiumReportAssetMeta(current.meta_json),
      sort_order: i,
    };
    await admin.from("premium_report_assets").update({ meta_json: nextMeta } as never).eq("id", id);
  }

  await admin.from("premium_report_actions").insert({
    request_id: params.id,
    action: "assets_reordered",
    actor: "admin",
    meta_json: { assetIds },
  } as never);

  return NextResponse.json({ ok: true });
}
