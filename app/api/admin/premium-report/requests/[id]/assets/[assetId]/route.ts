import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getPremiumReportAssetMeta } from "@/lib/premiumReportStorage";

function isImageAssetType(assetType: string) {
  return assetType === "chart_image" || assetType === "attachment_image";
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; assetId: string } }
) {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as {
    sortOrder?: number;
    isCover?: boolean;
    title?: string | null;
    description?: string | null;
  };

  const { data: asset, error: assetError } = await admin
    .from("premium_report_assets")
    .select("*")
    .eq("id", params.assetId)
    .eq("request_id", params.id)
    .maybeSingle();

  if (assetError || !asset) {
    return NextResponse.json({ error: "자산을 찾을 수 없습니다." }, { status: 404 });
  }

  const row = asset as {
    id: string;
    asset_type: string;
    meta_json: unknown;
  };
  const nextMeta = {
    ...getPremiumReportAssetMeta(row.meta_json),
  } as Record<string, unknown>;

  if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
    nextMeta.sort_order = Math.max(0, Math.floor(body.sortOrder));
  }
  if (typeof body.isCover === "boolean") {
    nextMeta.is_cover = body.isCover;
  }
  if ("title" in body) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    nextMeta.title = title || null;
  }
  if ("description" in body) {
    const description = typeof body.description === "string" ? body.description.trim() : "";
    nextMeta.description = description || null;
  }

  if (body.isCover === true && isImageAssetType(row.asset_type)) {
    const { data: siblings } = await admin
      .from("premium_report_assets")
      .select("id, meta_json")
      .eq("request_id", params.id)
      .in("asset_type", ["chart_image", "attachment_image"]);

    for (const sibling of (siblings ?? []) as { id: string; meta_json: unknown }[]) {
      if (sibling.id === params.assetId) continue;
      const siblingMeta = {
        ...getPremiumReportAssetMeta(sibling.meta_json),
        is_cover: false,
      };
      await admin.from("premium_report_assets").update({ meta_json: siblingMeta } as never).eq("id", sibling.id);
    }
  }

  const { data: updated, error: updateError } = await admin
    .from("premium_report_assets")
    .update({ meta_json: nextMeta } as never)
    .eq("id", params.assetId)
    .eq("request_id", params.id)
    .select("*")
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message ?? "자산 메타 저장 실패" }, { status: 500 });
  }

  await admin.from("premium_report_actions").insert({
    request_id: params.id,
    action: "asset_meta_updated",
    actor: "admin",
    meta_json: {
      assetId: params.assetId,
      patch: {
        sortOrder: body.sortOrder,
        isCover: body.isCover,
        title: body.title ?? undefined,
        description: body.description ?? undefined,
      },
    },
  } as never);

  return NextResponse.json({ ok: true, asset: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; assetId: string } }
) {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });

  const { data: asset, error: assetError } = await admin
    .from("premium_report_assets")
    .select("*")
    .eq("id", params.assetId)
    .eq("request_id", params.id)
    .maybeSingle();

  if (assetError || !asset) {
    return NextResponse.json({ error: "자산을 찾을 수 없습니다." }, { status: 404 });
  }

  const row = asset as {
    id: string;
    asset_type: string;
    storage_bucket: string | null;
    storage_path: string | null;
    meta_json: unknown;
  };

  if (row.storage_bucket && row.storage_path) {
    await admin.storage.from(row.storage_bucket).remove([row.storage_path]);
  }

  const { error: deleteError } = await admin
    .from("premium_report_assets")
    .delete()
    .eq("id", params.assetId)
    .eq("request_id", params.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  await admin.from("premium_report_actions").insert({
    request_id: params.id,
    action: "asset_deleted",
    actor: "admin",
    meta_json: {
      assetId: params.assetId,
      assetType: row.asset_type,
      originalName: getPremiumReportAssetMeta(row.meta_json).original_name ?? null,
    },
  } as never);

  return NextResponse.json({ ok: true });
}
