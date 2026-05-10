import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeNickname } from "@/lib/entitlements";
import { createSignedImageUrl } from "@/lib/imageStorage";
import { verifyParticipantAuthHash } from "@/lib/participantAuth";
import { hintFromPgError } from "@/lib/pgErrorHints";
import type { Database } from "@/types/supabase";

type AssetHistoryRow = Pick<
  Database["public"]["Tables"]["image_generation_assets"]["Row"],
  | "id"
  | "created_at"
  | "feature_key"
  | "prompt"
  | "prompt_hash"
  | "width"
  | "height"
  | "storage_bucket"
  | "storage_path"
>;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nickname = normalizeNickname(searchParams.get("nickname") ?? "");
  const rawNick = (searchParams.get("nickname") ?? "").trim().slice(0, 20);
  const authHash = (searchParams.get("authHash") ?? "").trim();
  const limit = Math.min(30, Math.max(1, Number(searchParams.get("limit") ?? "10")));
  if (!nickname) return NextResponse.json({ error: "닉네임이 필요합니다." }, { status: 400 });
  if (!authHash) {
    return NextResponse.json({ error: "인증이 필요합니다.", requiresAuth: true, items: [] }, { status: 401 });
  }
  const ok = await verifyParticipantAuthHash(rawNick, authHash);
  if (!ok) {
    return NextResponse.json({ error: "인증에 실패했습니다.", requiresAuth: true, items: [] }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB 연결을 사용할 수 없습니다." }, { status: 503 });

  const { data, error } = await admin
    .from("image_generation_assets")
    .select("id, created_at, feature_key, prompt, prompt_hash, width, height, storage_bucket, storage_path")
    .eq("nickname", nickname)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    const hint = hintFromPgError(error.message, error.code);
    return NextResponse.json(
      { error: hint ? `${error.message} — ${hint}` : error.message, items: [] },
      { status: 500 }
    );
  }

  const assetRows = (data ?? []) as AssetHistoryRow[];
  const items = await Promise.all(
    assetRows.map(async (row) => {
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

