import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getPremiumReportAssetMeta } from "@/lib/premiumReportStorage";
import { uploadPremiumReportBinary } from "@/lib/premiumReportStorage";

export type GeneratedImageRow = {
  id: string;
  created_at: string;
  feature_key: string;
  prompt: string;
  storage_bucket: string;
  storage_path: string;
  engine: string | null;
};

function autoImageMax() {
  const n = Number(process.env.PREMIUM_REPORT_AUTO_IMAGE_MAX ?? "3");
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(8, Math.round(n)));
}

function featureLabel(featureKey: string) {
  if (featureKey === "comic_4panel") return "4컷 스케치(2×2 그리드)";
  if (featureKey === "image_cut") return "한 장 스케치";
  return featureKey;
}

function titleForRow(row: GeneratedImageRow, index: number) {
  const label = featureLabel(row.feature_key);
  if (index === 0) return `생성 스케치 — ${label}(최근)`;
  return `생성 스케치 — ${label}`;
}

export async function importGeneratedImagesAsPremiumAssets(args: {
  requestId: string;
  nickname: string;
}): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const admin = getSupabaseAdmin();
  if (!admin) return { imported: 0, skipped: 0, errors: ["DB 연결 없음"] };

  const max = autoImageMax();

  const { data: existing } = await admin
    .from("premium_report_assets")
    .select("asset_type, meta_json")
    .eq("request_id", args.requestId);

  const linkedIds = new Set<string>();
  for (const row of (existing ?? []) as { asset_type: string; meta_json: unknown }[]) {
    if (row.asset_type !== "chart_image" && row.asset_type !== "attachment_image") continue;
    const meta = getPremiumReportAssetMeta(row.meta_json);
    const source = meta.source as { image_asset_id?: string } | undefined;
    if (source?.image_asset_id) linkedIds.add(source.image_asset_id);
  }

  const { data: genRows } = await admin
    .from("image_generation_assets")
    .select("id, created_at, feature_key, prompt, storage_bucket, storage_path, engine")
    .eq("nickname", args.nickname)
    .order("created_at", { ascending: false })
    .limit(max + linkedIds.size + 2);

  const candidates = ((genRows ?? []) as GeneratedImageRow[]).filter(
    (r) => r.storage_bucket && r.storage_path && !linkedIds.has(r.id)
  );

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < candidates.length && imported < max; i++) {
    const row = candidates[i];
    let buffer: Buffer | null = null;
    try {
      const downloaded = await admin.storage.from(row.storage_bucket).download(row.storage_path);
      const arrayBuffer = downloaded.error || !downloaded.data ? null : await downloaded.data.arrayBuffer();
      buffer = arrayBuffer ? Buffer.from(arrayBuffer) : null;
    } catch {
      buffer = null;
    }
    if (!buffer || buffer.byteLength === 0) {
      skipped += 1;
      continue;
    }

    const uploaded = await uploadPremiumReportBinary({
      nickname: args.nickname,
      requestId: args.requestId,
      assetType: "attachment_image",
      fileName: row.feature_key === "comic_4panel" ? "comic-grid.png" : "generated.png",
      mimeType: "image/png",
      buffer,
    });
    if (!uploaded.ok) {
      errors.push(uploaded.error);
      skipped += 1;
      continue;
    }

    const sortOrder = imported;
    const isCover = imported === 0;
    const meta = {
      title: titleForRow(row, imported),
      description: [
        `자동 첨부(서버 생성 이미지).`,
        `유형: ${featureLabel(row.feature_key)}`,
        `엔진: ${row.engine ?? "unknown"}`,
        `생성: ${new Date(row.created_at).toLocaleString("ko-KR")}`,
        row.feature_key === "comic_4panel"
          ? "4컷은 2×2 한 장 그리드입니다. PDF에서 한 페이지에 표시됩니다."
          : null,
      ]
        .filter(Boolean)
        .join(" "),
      original_name: row.storage_path.split("/").pop() ?? null,
      sort_order: sortOrder,
      is_cover: isCover,
      source: { type: "image_generation_assets", image_asset_id: row.id, created_at: row.created_at },
    };

    const { error } = await admin.from("premium_report_assets").insert({
      request_id: args.requestId,
      asset_type: "attachment_image",
      storage_bucket: uploaded.bucket,
      storage_path: uploaded.path,
      mime_type: "image/png",
      meta_json: meta,
    } as never);

    if (error) {
      errors.push(error.message);
      skipped += 1;
      continue;
    }
    imported += 1;
    linkedIds.add(row.id);
  }

  return { imported, skipped, errors };
}

export async function buildGeneratedImagesContextForReport(nickname: string, limit = 3) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const max = Math.min(limit, autoImageMax());
  const { data } = await admin
    .from("image_generation_assets")
    .select("created_at, feature_key, prompt, engine")
    .eq("nickname", nickname)
    .order("created_at", { ascending: false })
    .limit(max);

  const rows = (data ?? []) as {
    created_at?: string;
    feature_key?: string;
    prompt?: string;
    engine?: string | null;
  }[];
  if (rows.length === 0) return null;

  const blocks = rows.map((row, idx) => {
    const created = row.created_at ? new Date(row.created_at).toLocaleString("ko-KR") : "알 수 없음";
    const feature = featureLabel(row.feature_key ?? "image");
    const prompt = String(row.prompt ?? "").trim().slice(0, 400);
    return [
      `[이미지 ${idx + 1}] ${feature} · ${created} · 엔진 ${row.engine ?? "unknown"}`,
      prompt ? `프롬프트 요약: ${prompt}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [
    "최근 생성 이미지(연필 스케치 은유)를 바탕으로 보고서 톤을 맞춥니다. 인물/얼굴/신체는 언급하지 않습니다.",
    "구성 가이드:",
    "- 관찰: 장면(숲/바다/카페/하늘/산책길 등)을 있는 그대로 짧게",
    "- 통찰: 사용자 기록 핵심과 장면의 연결",
    "- 성찰: 스스로 알아차리게 하는 질문 2개",
    "- 통섭: 다음 1주 작은 실천 3개",
    "",
    "참고(최근 생성 이미지):",
    ...blocks,
  ].join("\n");
}
