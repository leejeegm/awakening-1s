import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getRecentSundayKeysKST } from "@/lib/premiumReport";
import { createSignedPremiumReportUrl, sortPremiumReportAssets } from "@/lib/premiumReportStorage";
import { getWeekRangeKST } from "@/lib/weekRange";
import { uploadPremiumReportBinary } from "@/lib/premiumReportStorage";

type PremiumSection = {
  key: string;
  title: string;
  body: string;
};

type RecordRow = {
  id: string;
  created_at: string;
  note: string;
  duration_type: string | null;
};

type AiHistoryRow = {
  content_type: string;
  content: string;
  created_at: string;
};

function toKstDateKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(iso))
    .replace(/\//g, "-");
}

function tokenizeKoreanish(text: string): string[] {
  return text
    .replace(/[\s.,!?;:'"()[\]{}<>\\/\-|_+=~`@#$%^&*]+/g, " ")
    .split(" ")
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);
}

function normalizeKeyword(word: string): string {
  const cleaned = word
    .trim()
    .replace(/^[“"'‘’`]+|[“"'‘’`]+$/g, "")
    .replace(
      /(이라고|라고|이라는|라는|으로는|로는|에게서|한테서|에서|에게|한테|으로|로|부터|까지|처럼|같이|보다|마저|조차|이나|나|와|과|도|만|은|는|이|가|을|를|에)$/u,
      ""
    )
    .trim();
  return cleaned.length >= 2 ? cleaned : word.trim();
}

function topKeywords(notes: string[], limit = 5): string[] {
  const map = new Map<string, number>();
  const stopwords = new Set(["오늘", "지금", "먼저", "다음", "기록", "기분", "마음", "생각", "정말", "너무", "그냥", "조금", "한번", "한"]);
  for (const n of notes) {
    for (const w of tokenizeKoreanish(n)) {
      const normalized = normalizeKeyword(w);
      if (normalized.length < 2 || stopwords.has(normalized)) continue;
      map.set(normalized, (map.get(normalized) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

function buildWeeklyStats(records: RecordRow[]) {
  const weeks = getRecentSundayKeysKST(4);
  return weeks.map((week) => {
    const range = getWeekRangeKST(week);
    const items = records.filter((row) => row.created_at >= range.from && row.created_at <= range.to);
    const distinctDays = new Set(items.map((row) => toKstDateKey(row.created_at))).size;
    return {
      week,
      label: range.label,
      recordCount: items.length,
      distinctDays,
      bar: "■".repeat(Math.min(7, distinctDays)) || "·",
    };
  });
}

function buildDurationSummary(records: RecordRow[]) {
  const counts = new Map<string, number>();
  for (const row of records) {
    const key = (row.duration_type ?? "기타").trim() || "기타";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `${key} ${count}회`)
    .join(" · ");
}

function buildDefaultSummary(args: {
  nickname: string;
  records: RecordRow[];
  keywords: string[];
  weeklyStats: ReturnType<typeof buildWeeklyStats>;
}) {
  const distinctDays = new Set(args.records.map((row) => toKstDateKey(row.created_at))).size;
  const activeWeeks = args.weeklyStats.filter((row) => row.recordCount > 0).length;
  const keywordText = args.keywords.length > 0 ? args.keywords.join(", ") : "아직 추출된 핵심 단어 없음";
  return `${args.nickname} 님은 최근 4주 동안 총 ${args.records.length}건을 기록했고, 실제 참여일은 ${distinctDays}일입니다. 활동이 있었던 주차는 ${activeWeeks}주이며, 자주 떠오른 단어는 ${keywordText}입니다.`;
}

function buildDefaultSections(args: {
  nickname: string;
  records: RecordRow[];
  notes: string[];
  aiHistory: AiHistoryRow[];
  weeklyStats: ReturnType<typeof buildWeeklyStats>;
  keywords: string[];
  imageContext?: string | null;
}) {
  const latestNotes = args.notes.slice(0, 6).map((note, i) => `${i + 1}. ${note}`).join("\n");
  const aiHistoryText = args.aiHistory
    .slice(0, 5)
    .map((item) => `- ${item.content_type}: ${item.content}`)
    .join("\n");
  const weeklyText = args.weeklyStats
    .map((row) => `${row.label} | 참여 ${row.distinctDays}일 | 기록 ${row.recordCount}건 | ${row.bar}`)
    .join("\n");
  const durationText = buildDurationSummary(args.records) || "기록 길이 데이터가 아직 충분하지 않습니다.";
  const keywordText = args.keywords.length > 0 ? args.keywords.map((word, i) => `${i + 1}. ${word}`).join("\n") : "핵심 단어를 아직 추출하지 못했습니다.";

  const baseSections: PremiumSection[] = [
    {
      key: "overview",
      title: "기록 개요",
      body: `${args.nickname} 님의 최근 분석 구간 기록은 총 ${args.records.length}건입니다.`,
    },
    ...(args.imageContext
      ? [
          {
            key: "visual-metaphor",
            title: "시각 은유(스케치) — 관찰·통찰·성찰·통섭",
            body: args.imageContext,
          },
        ]
      : []),
    {
      key: "weekly-rhythm",
      title: "4주 기록 리듬",
      body: weeklyText || "최근 4주 기록 요약이 아직 충분하지 않습니다.",
    },
    {
      key: "duration-pattern",
      title: "기록 길이 분포",
      body: durationText,
    },
    {
      key: "keywords",
      title: "자주 떠오른 핵심 단어",
      body: keywordText,
    },
    {
      key: "record-trend",
      title: "최근 기록 흐름",
      body: latestNotes || "최근 기록 샘플이 아직 충분하지 않습니다.",
    },
    {
      key: "message-history",
      title: "기존 맞춤 메시지 흐름",
      body: aiHistoryText || "저장된 맞춤 메시지 이력이 아직 없습니다.",
    },
  ];
  return baseSections satisfies PremiumSection[];
}

async function ensureSnapshot(requestId: string, nickname: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const { data: existing } = await admin
    .from("premium_report_source_snapshots")
    .select("*")
    .eq("request_id", requestId)
    .maybeSingle();

  if (existing) return existing;

  const weeks = getRecentSundayKeysKST(4);
  const firstWeek = getWeekRangeKST(weeks[0]);
  const lastWeek = getWeekRangeKST(weeks[weeks.length - 1]);

  const [profileRes, recordsRes, aiRes] = await Promise.all([
    admin
      .from("participant_profiles")
      .select("nickname, gender, age_group, updated_at")
      .eq("nickname", nickname)
      .maybeSingle(),
    admin
      .from("awakenings")
      .select("id, created_at, note, duration_type")
      .eq("nickname", nickname)
      .gte("created_at", firstWeek.from)
      .lte("created_at", lastWeek.to)
      .order("created_at", { ascending: false }),
    admin
      .from("ai_generated_content")
      .select("content_type, content, created_at")
      .eq("nickname", nickname)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const records = (recordsRes.data ?? []) as RecordRow[];
  const aiHistory = (aiRes.data ?? []) as AiHistoryRow[];
  const weeklyStats = buildWeeklyStats(records);
  const keywords = topKeywords(records.map((row) => row.note), 6);

  const snapshotPayload = {
    request_id: requestId,
    profile_json: profileRes.data ?? {},
    trend_json: {
      recordCount: records.length,
      distinctDays: new Set(records.map((row) => toKstDateKey(row.created_at))).size,
      durationSummary: buildDurationSummary(records),
      topKeywords: keywords,
      weeklyStats,
      recentNotes: records.slice(0, 12).map((row) => ({
        created_at: row.created_at,
        note: row.note,
        duration_type: row.duration_type,
      })),
    },
    ai_history_json: aiHistory,
    record_window_from: firstWeek.from,
    record_window_to: lastWeek.to,
  };

  const { data: inserted } = await admin
    .from("premium_report_source_snapshots")
    .insert(snapshotPayload as never)
    .select("*")
    .single();

  return inserted ?? snapshotPayload;
}

async function importLatestGeneratedImageAsPremiumAsset(args: { requestId: string; nickname: string }) {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false as const, reason: "no_admin" as const };

  // 이미 커버/첨부 이미지가 있으면 자동 첨부는 하지 않음 (운영 안전)
  const { data: existing } = await admin
    .from("premium_report_assets")
    .select("id, asset_type, meta_json, created_at")
    .eq("request_id", args.requestId)
    .order("created_at", { ascending: false });

  const existingRows = (existing ?? []) as { asset_type: string; meta_json: unknown }[];
  const hasAnyImage = existingRows.some((r) => r.asset_type === "chart_image" || r.asset_type === "attachment_image");
  if (hasAnyImage) return { ok: true as const, imported: false as const };

  const { data: gen } = await admin
    .from("image_generation_assets")
    .select("id, created_at, feature_key, prompt, storage_bucket, storage_path, engine")
    .eq("nickname", args.nickname)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = (gen ?? null) as
    | {
        id: string;
        created_at: string;
        feature_key: string;
        prompt: string;
        storage_bucket: string;
        storage_path: string;
        engine: string | null;
      }
    | null;
  if (!row?.storage_bucket || !row.storage_path) return { ok: true as const, imported: false as const };

  let buffer: Buffer | null = null;
  try {
    const downloaded = await admin.storage.from(row.storage_bucket).download(row.storage_path);
    const arrayBuffer = downloaded.error || !downloaded.data ? null : await downloaded.data.arrayBuffer();
    buffer = arrayBuffer ? Buffer.from(arrayBuffer) : null;
  } catch {
    buffer = null;
  }
  if (!buffer || buffer.byteLength === 0) return { ok: true as const, imported: false as const };

  const uploaded = await uploadPremiumReportBinary({
    nickname: args.nickname,
    requestId: args.requestId,
    assetType: "attachment_image",
    fileName: "generated.png",
    mimeType: "image/png",
    buffer,
  });
  if (!uploaded.ok) return { ok: false as const, reason: "upload_failed" as const, error: uploaded.error };

  const meta = {
    title: "생성 스케치(최근)",
    description: `최근 생성 이미지(자동 첨부). 엔진=${row.engine ?? "unknown"} · feature=${row.feature_key} · 생성시각=${new Date(row.created_at).toLocaleString(
      "ko-KR"
    )}`,
    original_name: row.storage_path.split("/").pop() ?? null,
    sort_order: 0,
    is_cover: true,
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

  if (error) return { ok: false as const, reason: "db_insert_failed" as const, error: error.message };
  return { ok: true as const, imported: true as const, imageMeta: { prompt: row.prompt, engine: row.engine, created_at: row.created_at } };
}

async function loadLatestGeneratedImageContext(nickname: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data } = await admin
    .from("image_generation_assets")
    .select("created_at, feature_key, prompt, engine")
    .eq("nickname", nickname)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = (data ?? null) as { created_at?: string; feature_key?: string; prompt?: string; engine?: string | null } | null;
  if (!row?.prompt) return null;
  const created = row.created_at ? new Date(row.created_at).toLocaleString("ko-KR") : "알 수 없음";
  const engine = row.engine ?? "unknown";
  const feature = row.feature_key ?? "image";
  const prompt = String(row.prompt).trim().slice(0, 600);
  return [
    `최근 생성 이미지(엔진: ${engine}, 유형: ${feature}, 시각: ${created})를 바탕으로, 보고서 전체 톤을 ‘자연/일상 연필 스케치 은유’에 맞춥니다.`,
    `- 관찰: 이미지에 담긴 장면을 ‘있는 그대로’ 짧게 묘사(과잉 해석 금지)`,
    `- 통찰: 사용자 기록의 핵심 단어/리듬과 장면 사이의 연결을 한 문단`,
    `- 성찰: 이번 주에 반복된 패턴/감각을 스스로 알아차리게 하는 질문 2개`,
    `- 통섭: 다음 1주 행동(작고 구체적인 실천) 3개`,
    ``,
    `참고(생성 프롬프트 일부):`,
    prompt,
  ].join("\n");
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });

  const { data: requestRow, error: requestError } = await admin
    .from("premium_report_requests")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (requestError || !requestRow) {
    return NextResponse.json({ error: "신청을 찾을 수 없습니다." }, { status: 404 });
  }

  const nickname = (requestRow as { nickname: string }).nickname;
  const snapshot = await ensureSnapshot(params.id, nickname);

  // MVP: 최근 생성 이미지를 자동 첨부(커버)로 1회 가져오기 (이미지가 전혀 없을 때만)
  await importLatestGeneratedImageAsPremiumAsset({ requestId: params.id, nickname });

  const [docRes, historyRes, assetRes, actionRes] = await Promise.all([
    admin
      .from("premium_report_documents")
      .select("*")
      .eq("request_id", params.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("premium_report_documents")
      .select("*")
      .eq("request_id", params.id)
      .order("version", { ascending: false })
      .limit(20),
    admin
      .from("premium_report_assets")
      .select("*")
      .eq("request_id", params.id)
      .order("created_at", { ascending: false }),
    admin
      .from("premium_report_actions")
      .select("id, action, actor, meta_json, created_at")
      .eq("request_id", params.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const latestDocument = docRes.data as
    | {
        title: string;
        summary_text: string | null;
        sections_json: PremiumSection[] | null;
        page_count: number;
        version: number;
        pdf_status: string;
      }
    | null;

  const snapshotObj = snapshot as
    | {
        trend_json?: {
          recordCount?: number;
          topKeywords?: string[];
          weeklyStats?: ReturnType<typeof buildWeeklyStats>;
          recentNotes?: { note?: string; created_at?: string; duration_type?: string | null }[];
        };
        ai_history_json?: AiHistoryRow[];
      }
    | null;

  const recentRecords = (snapshotObj?.trend_json?.recentNotes ?? []).map((row) => ({
    id: row.created_at ?? "",
    created_at: row.created_at ?? "",
    note: row.note ?? "",
    duration_type: row.duration_type ?? null,
  }));
  const weeklyStats = Array.isArray(snapshotObj?.trend_json?.weeklyStats)
    ? snapshotObj!.trend_json!.weeklyStats
    : buildWeeklyStats(recentRecords);
  const keywords = Array.isArray(snapshotObj?.trend_json?.topKeywords) ? snapshotObj.trend_json!.topKeywords! : topKeywords(recentRecords.map((row) => row.note), 6);
  const imageContext = await loadLatestGeneratedImageContext(nickname);
  const draftSections = buildDefaultSections({
    nickname,
    records: recentRecords,
    notes: recentRecords.map((row) => row.note).filter(Boolean),
    aiHistory: Array.isArray(snapshotObj?.ai_history_json) ? snapshotObj.ai_history_json : [],
    weeklyStats,
    keywords,
    imageContext,
  });
  const summaryText = buildDefaultSummary({
    nickname,
    records: recentRecords,
    keywords,
    weeklyStats,
  });

  const sortedAssets = sortPremiumReportAssets(
    (assetRes.data ?? []) as {
      id: string;
      asset_type: string;
      storage_bucket: string | null;
      storage_path: string | null;
      mime_type: string | null;
      meta_json: unknown;
      created_at: string;
    }[]
  );

  const assetsWithUrls = await Promise.all(
    sortedAssets.map(async (asset) => {
      const row = asset as {
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
      return { ...row, download_url };
    })
  );

  return NextResponse.json({
    request: requestRow,
    snapshot: snapshot ?? null,
    document:
      latestDocument ?? {
        title: "나의 자깨 감응 보고서",
        summary_text: summaryText,
        sections_json: draftSections,
        page_count: 4,
        version: 0,
        pdf_status: "draft",
      },
    history: historyRes.data ?? [],
    assets: assetsWithUrls,
    actions: actionRes.data ?? [],
  });
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
    title?: string;
    summaryText?: string | null;
    pageCount?: number;
    sections?: PremiumSection[];
  };

  const { data: requestRow, error: requestError } = await admin
    .from("premium_report_requests")
    .select("id, nickname")
    .eq("id", params.id)
    .maybeSingle();

  if (requestError || !requestRow) {
    return NextResponse.json({ error: "신청을 찾을 수 없습니다." }, { status: 404 });
  }

  await ensureSnapshot(params.id, (requestRow as { nickname: string }).nickname);

  const { data: latest } = await admin
    .from("premium_report_documents")
    .select("version")
    .eq("request_id", params.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = ((latest as { version?: number } | null)?.version ?? 0) + 1;

  const sections = Array.isArray(body.sections) ? body.sections : [];
  const { error } = await admin.from("premium_report_documents").insert({
    request_id: params.id,
    version,
    title: (body.title ?? "나의 자깨 감응 보고서").trim(),
    summary_text: body.summaryText ?? null,
    sections_json: sections,
    page_count: Math.max(1, Math.min(100, Number(body.pageCount ?? 4) || 4)),
    pdf_status: "draft",
    created_by: "admin",
    updated_by: "admin",
  } as never);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.from("premium_report_actions").insert({
    request_id: params.id,
    action: "document_saved",
    actor: "admin",
    meta_json: { version, sectionCount: sections.length },
  } as never);

  return NextResponse.json({ ok: true, version, pdfStatus: "draft" });
}
