import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  createSignedPremiumReportUrl,
  getPremiumReportAssetMeta,
  getPremiumReportAssetSortOrder,
  isPremiumReportAssetCover,
  uploadPremiumReportBinary,
} from "@/lib/premiumReportStorage";

type UploadAssetType = "chart_image" | "attachment_image" | "attachment_pdf";

function toUploadAssetType(value: string): UploadAssetType | null {
  if (value === "chart_image" || value === "attachment_image" || value === "attachment_pdf") {
    return value;
  }
  return null;
}

function isAllowedMime(assetType: UploadAssetType, mimeType: string) {
  const lower = mimeType.toLowerCase();
  if (assetType === "attachment_pdf") return lower === "application/pdf";
  return lower === "image/png" || lower === "image/jpeg" || lower === "image/webp";
}

function inferMimeType(fileName: string, currentMimeType: string) {
  if (currentMimeType) return currentMimeType;
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "";
}

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
    assetType?: string;
    fileName?: string;
    mimeType?: string;
    base64?: string;
  };

  const assetType = toUploadAssetType((body.assetType ?? "").trim());
  const fileName = (body.fileName ?? "").trim();
  const mimeType = inferMimeType(fileName, (body.mimeType ?? "").trim().toLowerCase());
  let base64 = (body.base64 ?? "").trim();

  if (!assetType || !mimeType || !base64) {
    return NextResponse.json({ error: "assetType, mimeType, base64가 필요합니다." }, { status: 400 });
  }
  if (!isAllowedMime(assetType, mimeType)) {
    return NextResponse.json(
      { error: assetType === "attachment_pdf" ? "PDF 파일만 업로드할 수 있습니다." : "이미지는 PNG, JPG, WEBP만 업로드할 수 있습니다." },
      { status: 400 }
    );
  }
  if (base64.startsWith("data:")) {
    const idx = base64.indexOf("base64,");
    base64 = idx >= 0 ? base64.slice(idx + "base64,".length) : base64;
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength === 0) {
    return NextResponse.json({ error: "빈 파일은 업로드할 수 없습니다." }, { status: 400 });
  }
  if (buffer.byteLength > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "업로드 파일은 15MB 이하만 허용됩니다." }, { status: 400 });
  }

  const { data: requestRow, error: requestError } = await admin
    .from("premium_report_requests")
    .select("id, nickname")
    .eq("id", params.id)
    .maybeSingle();

  if (requestError || !requestRow) {
    return NextResponse.json({ error: "신청을 찾을 수 없습니다." }, { status: 404 });
  }

  const nickname = (requestRow as { nickname: string }).nickname;
  const { data: existingAssets } = await admin
    .from("premium_report_assets")
    .select("asset_type, meta_json, created_at")
    .eq("request_id", params.id);

  const editableAssets = ((existingAssets ?? []) as {
    asset_type: string;
    meta_json: unknown;
    created_at: string;
  }[]).filter((item) => item.asset_type !== "final_pdf");
  const nextSortOrder =
    editableAssets.length === 0
      ? 0
      : Math.max(
          ...editableAssets.map((item, index) => getPremiumReportAssetSortOrder(item.meta_json, index))
        ) + 1;
  const hasCoverImage = editableAssets.some(
    (item) =>
      (item.asset_type === "chart_image" || item.asset_type === "attachment_image") &&
      isPremiumReportAssetCover(item.meta_json)
  );

  const uploaded = await uploadPremiumReportBinary({
    nickname,
    requestId: params.id,
    assetType,
    fileName,
    mimeType,
    buffer,
  });

  if (!uploaded.ok) {
    return NextResponse.json({ error: uploaded.error }, { status: 500 });
  }

  const meta = {
    ...getPremiumReportAssetMeta({}),
    original_name: fileName || null,
    bytes: buffer.byteLength,
    uploaded_at: new Date().toISOString(),
    sort_order: nextSortOrder,
    is_cover:
      (assetType === "chart_image" || assetType === "attachment_image") && !hasCoverImage ? true : false,
  };

  const { data: assetRow, error: assetError } = await admin
    .from("premium_report_assets")
    .insert({
      request_id: params.id,
      asset_type: assetType,
      storage_bucket: uploaded.bucket,
      storage_path: uploaded.path,
      mime_type: mimeType,
      meta_json: meta,
    } as never)
    .select("*")
    .single();

  if (assetError || !assetRow) {
    return NextResponse.json({ error: assetError?.message ?? "자산 저장 실패" }, { status: 500 });
  }

  await admin.from("premium_report_actions").insert({
    request_id: params.id,
    action: "asset_uploaded",
    actor: "admin",
    meta_json: { assetId: assetRow.id, assetType, fileName, bytes: buffer.byteLength },
  } as never);

  const row = assetRow as {
    id: string;
    asset_type: string;
    storage_bucket: string | null;
    storage_path: string | null;
    mime_type: string | null;
    meta_json: unknown;
    created_at: string;
  };
  const download_url =
    row.storage_bucket && row.storage_path
      ? await createSignedPremiumReportUrl(row.storage_bucket, row.storage_path, 60 * 10)
      : null;

  return NextResponse.json({
    ok: true,
    asset: {
      ...row,
      download_url,
    },
  });
}
