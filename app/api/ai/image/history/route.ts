import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeNickname } from "@/lib/entitlements";
import { createSignedImageUrl } from "@/lib/imageStorage";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nickname = normalizeNickname(searchParams.get("nickname") ?? "");
  const limit = Math.min(30, Math.max(1, Number(searchParams.get("limit") ?? "10")));
  if (!nickname) return NextResponse.json({ error: "닉네임이 필요합니다." }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB 연결을 사용할 수 없습니다." }, { status: 503 });

  const { data, error } = await admin
    .from("image_generation_assets")
    .select("id, created_at, feature_key, prompt, prompt_hash, width, height, storage_bucket, storage_path")
    .eq("nickname", nickname)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = await Promise.all(
    (data ?? []).map(async (row) => {
      const url = await createSignedImageUrl(row.storage_bucket, row.storage_path, 60 * 10);
      return {
        id: row.id,
        created_at: row.created_at,
        feature_key: row.feature_key,
        prompt: row.prompt,
        prompt_hash: row.prompt_hash,
        width: row.width,
        height: row.height,
        url,
      };
    })
  );

  return NextResponse.json({ nickname, items });
}

