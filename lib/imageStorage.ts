import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import crypto from "crypto";

export function getImageBucket() {
  return process.env.IMAGE_BUCKET ?? "generated";
}

export function sha256Hex(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export async function ensureBucketExists(bucket: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return false;
  try {
    // listBuckets는 권한이 있는 경우에만 동작
    const { data } = await admin.storage.listBuckets();
    if (data?.some((b) => b.name === bucket)) return true;
    await admin.storage.createBucket(bucket, { public: false });
    return true;
  } catch {
    // Supabase 프로젝트 설정에 따라 createBucket이 막힐 수 있음 (대시보드에서 수동 생성 가능)
    return false;
  }
}

export async function uploadPngBase64(params: {
  nickname: string;
  base64: string; // raw base64 (no prefix)
  featureKey: string;
}): Promise<{ ok: true; bucket: string; path: string } | { ok: false; error: string }> {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: "DB/스토리지 연결을 사용할 수 없습니다." };
  const bucket = getImageBucket();
  await ensureBucketExists(bucket);

  const n = (params.nickname ?? "").trim().toLowerCase();
  const feature = (params.featureKey ?? "").trim();
  if (!n || !feature) return { ok: false, error: "닉네임/기능키가 필요합니다." };

  let b64 = params.base64.trim();
  if (b64.startsWith("data:")) {
    const idx = b64.indexOf("base64,");
    b64 = idx >= 0 ? b64.slice(idx + "base64,".length) : b64;
  }

  const buf = Buffer.from(b64, "base64");
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10); // UTC 기준 폴더링(단순)
  const rand = crypto.randomBytes(8).toString("hex");
  const path = `${n}/${ymd}/${feature}-${now.getTime()}-${rand}.png`;

  const { error } = await admin.storage.from(bucket).upload(path, buf, {
    contentType: "image/png",
    upsert: false,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, bucket, path };
}

export async function createSignedImageUrl(bucket: string, path: string, expiresInSec = 60 * 10) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  try {
    const { data } = await admin.storage.from(bucket).createSignedUrl(path, expiresInSec);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

