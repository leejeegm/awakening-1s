import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeNickname } from "@/lib/entitlements";
import { createSignedImageUrl } from "@/lib/imageStorage";
import { hintFromPgError } from "@/lib/pgErrorHints";

function formatDbError(err: { message: string; code?: string }) {
  const hint = hintFromPgError(err.message, err.code);
  return hint ? `${err.message} — ${hint}` : err.message;
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const nickFilter = normalizeNickname(searchParams.get("nickname") ?? "");
  const limit = Math.min(100, Math.max(10, Number(searchParams.get("limit") ?? "40")));
  const assetLimit = Math.min(30, limit);

  let entQ = admin
    .from("admin_entitlement_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (nickFilter) entQ = entQ.eq("nickname", nickFilter);

  let usageQ = admin
    .from("image_generation_usage")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (nickFilter) usageQ = usageQ.eq("nickname", nickFilter);

  let assetQ = admin
    .from("image_generation_assets")
    .select(
      "id, created_at, nickname, feature_key, mode, prompt, prompt_hash, width, height, storage_bucket, storage_path"
    )
    .order("created_at", { ascending: false })
    .limit(assetLimit);
  if (nickFilter) assetQ = assetQ.eq("nickname", nickFilter);

  const [entRes, usageRes, assetRes] = await Promise.all([entQ, usageQ, assetQ]);

  if (entRes.error) {
    return NextResponse.json({ error: formatDbError(entRes.error) }, { status: 500 });
  }
  if (usageRes.error) {
    return NextResponse.json({ error: formatDbError(usageRes.error) }, { status: 500 });
  }
  if (assetRes.error) {
    return NextResponse.json({ error: formatDbError(assetRes.error) }, { status: 500 });
  }

  type AssetRow = {
    id: string;
    created_at: string;
    nickname: string;
    feature_key: string;
    mode: string;
    prompt: string;
    prompt_hash: string;
    width: number | null;
    height: number | null;
    storage_bucket: string;
    storage_path: string;
  };

  const assetsRaw = (assetRes.data ?? []) as AssetRow[];
  const assets = await Promise.all(
    assetsRaw.map(async (row) => {
      const previewUrl = await createSignedImageUrl(row.storage_bucket, row.storage_path, 60 * 5);
      const promptPreview =
        row.prompt.length > 200 ? `${row.prompt.slice(0, 200)}…` : row.prompt;
      return {
        id: row.id,
        created_at: row.created_at,
        nickname: row.nickname,
        feature_key: row.feature_key,
        mode: row.mode,
        prompt_preview: promptPreview,
        prompt_hash: row.prompt_hash,
        width: row.width,
        height: row.height,
        storage_bucket: row.storage_bucket,
        storage_path: row.storage_path,
        preview_url: previewUrl,
      };
    })
  );

  return NextResponse.json({
    entitlement_actions: entRes.data ?? [],
    image_usage: usageRes.data ?? [],
    image_assets: assets,
  });
}
