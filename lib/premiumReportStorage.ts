import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { ensureBucketExists } from "@/lib/imageStorage";

export function getPremiumReportBucket() {
  return process.env.PREMIUM_REPORT_BUCKET ?? "premium-reports";
}

function sanitizeExt(ext: string) {
  return ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
}

function extFromMimeType(mimeType: string) {
  const lower = mimeType.toLowerCase();
  if (lower === "application/pdf") return "pdf";
  if (lower === "image/png") return "png";
  if (lower === "image/jpeg") return "jpg";
  if (lower === "image/webp") return "webp";
  if (lower === "image/gif") return "gif";
  return "bin";
}

export async function uploadPremiumReportBinary(params: {
  nickname: string;
  requestId: string;
  assetType: string;
  fileName?: string | null;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ ok: true; bucket: string; path: string } | { ok: false; error: string }> {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: "DB/스토리지 연결을 사용할 수 없습니다." };

  const bucket = getPremiumReportBucket();
  await ensureBucketExists(bucket);

  const nickname = (params.nickname ?? "").trim().toLowerCase();
  const requestId = (params.requestId ?? "").trim();
  const assetType = (params.assetType ?? "").trim().toLowerCase();
  if (!nickname || !requestId || !assetType) {
    return { ok: false, error: "닉네임 또는 요청 ID 또는 자산 유형이 비어 있습니다." };
  }

  const now = new Date();
  const ymd = now.toISOString().slice(0, 10);
  const rand = crypto.randomBytes(8).toString("hex");
  const ext =
    params.fileName && params.fileName.includes(".")
      ? sanitizeExt(params.fileName.split(".").pop() ?? "")
      : extFromMimeType(params.mimeType);
  const path = `${nickname}/${ymd}/${requestId}/${assetType}-${now.getTime()}-${rand}.${ext}`;

  const { error } = await admin.storage.from(bucket).upload(path, params.buffer, {
    contentType: params.mimeType,
    upsert: false,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true, bucket, path };
}

export async function uploadPremiumReportPdf(params: {
  nickname: string;
  requestId: string;
  version: number;
  pdf: Buffer;
}): Promise<{ ok: true; bucket: string; path: string } | { ok: false; error: string }> {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: "DB/스토리지 연결을 사용할 수 없습니다." };

  const bucket = getPremiumReportBucket();
  await ensureBucketExists(bucket);

  const nickname = (params.nickname ?? "").trim().toLowerCase();
  const requestId = (params.requestId ?? "").trim();
  if (!nickname || !requestId) {
    return { ok: false, error: "닉네임 또는 요청 ID가 비어 있습니다." };
  }

  const now = new Date();
  const ymd = now.toISOString().slice(0, 10);
  const rand = crypto.randomBytes(8).toString("hex");
  const path = `${nickname}/${ymd}/premium-report-${requestId}-v${params.version}-${rand}.pdf`;

  const { error } = await admin.storage.from(bucket).upload(path, params.pdf, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true, bucket, path };
}

export async function createSignedPremiumReportUrl(bucket: string, path: string, expiresInSec = 60 * 10) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  try {
    const { data } = await admin.storage.from(bucket).createSignedUrl(path, expiresInSec);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

export type PremiumReportPdfImageAsset = {
  assetType: "chart_image" | "attachment_image";
  title: string;
  originalName: string | null;
  description?: string | null;
  mimeType: string;
  dataUrl: string;
  isCover?: boolean;
};

export type PremiumReportPdfAttachment = {
  assetType: "attachment_pdf";
  title: string;
  originalName: string | null;
  description?: string | null;
  pdfBuffer?: Buffer;
};

export type PremiumReportAssetMeta = {
  original_name?: string | null;
  title?: string | null;
  description?: string | null;
  bytes?: number;
  uploaded_at?: string;
  sort_order?: number;
  is_cover?: boolean;
  [key: string]: unknown;
};

export function getPremiumReportAssetMeta(meta: unknown): PremiumReportAssetMeta {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  return meta as PremiumReportAssetMeta;
}

export function getPremiumReportAssetSortOrder(meta: unknown, fallback: number) {
  const raw = getPremiumReportAssetMeta(meta).sort_order;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
}

export function isPremiumReportAssetCover(meta: unknown) {
  return getPremiumReportAssetMeta(meta).is_cover === true;
}

export function sortPremiumReportAssets<T extends { asset_type: string; created_at: string; meta_json: unknown }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const aFinal = a.asset_type === "final_pdf" ? 1 : 0;
    const bFinal = b.asset_type === "final_pdf" ? 1 : 0;
    if (aFinal !== bFinal) return aFinal - bFinal;

    const aOrder = getPremiumReportAssetSortOrder(a.meta_json, Number.MAX_SAFE_INTEGER);
    const bOrder = getPremiumReportAssetSortOrder(b.meta_json, Number.MAX_SAFE_INTEGER);
    if (aOrder !== bOrder) return aOrder - bOrder;

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

function toPdfImageFormat(mimeType: string) {
  const lower = mimeType.toLowerCase();
  if (lower === "image/png") return "PNG";
  if (lower === "image/webp") return "WEBP";
  return "JPEG";
}

export async function loadPremiumReportPdfAssets(requestId: string): Promise<{
  imageAssets: PremiumReportPdfImageAsset[];
  attachmentPdfs: PremiumReportPdfAttachment[];
}> {
  const admin = getSupabaseAdmin();
  if (!admin) return { imageAssets: [], attachmentPdfs: [] };

  const { data, error } = await admin
    .from("premium_report_assets")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });

  if (error || !data) return { imageAssets: [], attachmentPdfs: [] };

  const imageAssets: PremiumReportPdfImageAsset[] = [];
  const attachmentPdfs: PremiumReportPdfAttachment[] = [];

  const sortedAssets = sortPremiumReportAssets(
    data as {
      asset_type: string;
      created_at: string;
      storage_bucket: string | null;
      storage_path: string | null;
      mime_type: string | null;
      meta_json: unknown;
    }[]
  );

  for (const asset of sortedAssets as {
    asset_type: string;
    storage_bucket: string | null;
    storage_path: string | null;
    mime_type: string | null;
    meta_json: unknown;
  }[]) {
    const assetType = asset.asset_type;
    const meta = getPremiumReportAssetMeta(asset.meta_json);
    const originalName = meta.original_name == null ? null : String(meta.original_name) || null;
    const title =
      meta.title == null || String(meta.title).trim() === ""
        ? assetType === "chart_image"
          ? "차트 이미지"
          : assetType === "attachment_image"
            ? "첨부 이미지"
            : "첨부 PDF"
        : String(meta.title).trim();
    const description =
      meta.description == null || String(meta.description).trim() === ""
        ? null
        : String(meta.description).trim();
    const isCover = meta.is_cover === true;

    if (assetType === "attachment_pdf") {
      if (!asset.storage_bucket || !asset.storage_path) {
        attachmentPdfs.push({
          assetType: "attachment_pdf",
          title,
          originalName,
          description,
        });
        continue;
      }

      try {
        const downloaded = await admin.storage.from(asset.storage_bucket).download(asset.storage_path);
        const arrayBuffer = downloaded.error || !downloaded.data ? null : await downloaded.data.arrayBuffer();
        attachmentPdfs.push({
          assetType: "attachment_pdf",
          title,
          originalName,
          description,
          pdfBuffer: arrayBuffer ? Buffer.from(arrayBuffer) : undefined,
        });
      } catch {
        attachmentPdfs.push({
          assetType: "attachment_pdf",
          title,
          originalName,
          description,
        });
      }
      continue;
    }

    if (assetType !== "chart_image" && assetType !== "attachment_image") continue;
    if (!asset.storage_bucket || !asset.storage_path || !asset.mime_type) continue;
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(asset.mime_type)) continue;

    try {
      const downloaded = await admin.storage.from(asset.storage_bucket).download(asset.storage_path);
      if (downloaded.error || !downloaded.data) continue;

      const arrayBuffer = await downloaded.data.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const mimeType = asset.mime_type.toLowerCase() === "image/jpg" ? "image/jpeg" : asset.mime_type;
      const dataUrl = `data:${mimeType};base64,${base64}`;

      imageAssets.push({
        assetType,
        title,
        originalName,
        description,
        mimeType,
        dataUrl,
        isCover,
      });
    } catch {
      continue;
    }
  }

  return { imageAssets, attachmentPdfs };
}

export function getPdfImageFormatFromMimeType(mimeType: string) {
  return toPdfImageFormat(mimeType);
}
