"use client";

import { useState, useEffect, useCallback } from "react";
import { formatAiContentAdminLines } from "@/lib/aiAdminMeta";

type RecordRow = {
  id: string;
  created_at: string;
  nickname: string;
  note: string;
  duration_type?: string;
};

type MemberRow = {
  nickname: string;
  password_hint: string | null;
  entitlements?: { image_cut: boolean; comic_4panel: boolean };
};

type ProfileRow = {
  nickname: string;
  gender: string | null;
  age_group: string | null;
  updated_at: string;
};

type AiContentRow = {
  id: string;
  nickname: string;
  content_type: string;
  content: string;
  meta: unknown;
  created_at: string;
};

type AdminTab =
  | "records"
  | "members"
  | "profiles"
  | "ai_content"
  | "moderation_quarantine"
  | "entitlements"
  | "image_audit"
  | "premium_reports"
  | "premium_eligibility";

type EntitlementActionRow = {
  id: string;
  created_at: string;
  nickname: string;
  feature_key: string;
  enabled: boolean;
  expires_at: string | null;
  source: string | null;
  enabled_by: string | null;
};

type ImageEntitlementRequestRow = {
  id: string;
  nickname: string;
  feature_key: "image_cut" | "comic_4panel";
  status: "pending" | "approved" | "rejected" | "cancelled";
  payment_status: "unpaid" | "paid" | "waived";
  requested_at: string;
  payment_confirmed_at: string | null;
  payment_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  admin_note: string | null;
};

type ImageUsageRow = {
  id: string;
  created_at: string;
  nickname: string;
  feature_key: string;
  mode: string;
};

type ImageAssetAuditRow = {
  id: string;
  created_at: string;
  nickname: string;
  feature_key: string;
  mode: string;
  prompt_preview: string;
  prompt_hash: string;
  width: number | null;
  height: number | null;
  storage_bucket: string;
  storage_path: string;
  preview_url: string | null;
};

type EntitlementRow = {
  feature_key: "image_cut" | "comic_4panel";
  enabled: boolean;
  source: string | null;
  enabled_by: string | null;
  expires_at: string | null;
  updated_at: string;
};

type PremiumReportProductRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  default_pages: number;
  sections_json: unknown;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type PremiumEligListItem = {
  requestId: string;
  nickname: string;
  status: string;
  payment_status: string;
  requested_at: string;
  updated_at: string;
  qualifies: boolean | null;
  qualifiesWeekly: boolean | null;
  qualifiesRolling: boolean | null;
  eligibilityEvaluatedAt: string | null;
};

type PremiumEligibilityCheckResult = {
  nickname?: string;
  canApplyPremiumReport?: boolean;
  message?: string;
  hasParticipantKey?: boolean;
  passwordHint?: string | null;
  qualifiesWeekly?: boolean;
  qualifiesRolling?: boolean;
  weeklyDayCounts?: { week: string; distinctDays: number; qualifies: boolean }[];
  rolling?: { recordCount: number; minRecords: number; windowDays: number };
  criteria?: { weekly?: string; rollingTest?: string };
  recentRequests?: { status: string; payment_status: string; updated_at: string }[];
};

type PremiumReportRequestRow = {
  id: string;
  nickname: string;
  product_id: string;
  status: string;
  payment_status: string;
  admin_note: string | null;
  approved_by: string | null;
  approved_at: string | null;
  downloadable: boolean;
  downloadable_at: string | null;
  expires_at: string | null;
  requested_at: string;
  updated_at: string;
};

type PremiumReportSectionRow = {
  key: string;
  title: string;
  body: string;
};

type PremiumReportDocumentRow = {
  id?: string;
  title: string;
  summary_text: string | null;
  sections_json: PremiumReportSectionRow[];
  page_count: number;
  version: number;
  pdf_status: string;
  created_at?: string;
};

type PremiumReportAssetRow = {
  id: string;
  asset_type: string;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  meta_json: unknown;
  created_at: string;
  download_url?: string | null;
};

type PremiumReportActionRow = {
  id: string;
  action: string;
  actor: string | null;
  meta_json: unknown;
  created_at: string;
};

type PremiumUploadAssetType = "chart_image" | "attachment_image" | "attachment_pdf";

type PremiumAssetDraft = {
  title: string;
  description: string;
};

type PremiumDocBaseline = {
  title: string;
  summary: string;
  pageCount: number;
  sections: PremiumReportSectionRow[];
  assetDrafts: Record<string, PremiumAssetDraft>;
};

type FormattedPremiumActionItem = {
  title: string;
  details: string[];
  targetAssetId?: string | null;
  targetDocumentVersion?: number | null;
};

function getPremiumAssetMeta(meta: unknown) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  return meta as {
    original_name?: unknown;
    title?: unknown;
    description?: unknown;
    sort_order?: unknown;
    is_cover?: unknown;
  };
}

function getPremiumAssetDefaultTitle(assetType: string) {
  if (assetType === "chart_image") return "차트 이미지";
  if (assetType === "attachment_image") return "첨부 이미지";
  if (assetType === "attachment_pdf") return "첨부 PDF";
  if (assetType === "final_pdf") return "최종 PDF";
  return assetType;
}

function getPremiumAssetTypeLabel(assetType: string) {
  if (assetType === "chart_image") return "차트 이미지";
  if (assetType === "attachment_image") return "첨부 이미지";
  if (assetType === "attachment_pdf") return "첨부 PDF";
  if (assetType === "final_pdf") return "최종 PDF";
  return assetType;
}

function getPremiumAssetPdfPlacement(assetType: string, isCover: boolean) {
  if (assetType === "attachment_pdf") return "PDF의 참고 첨부 자료 목록";
  if (assetType === "chart_image" || assetType === "attachment_image") {
    return isCover ? "PDF 첫 장의 대표 시각 자료" : "PDF 본문의 시각 자료 섹션";
  }
  if (assetType === "final_pdf") return "발행 결과 파일";
  return "PDF 자산";
}

function compactPreviewText(value: string, maxLength = 180) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength).trim()}...` : normalized;
}

function normalizeDiffText(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

function buildPremiumSectionDiffs(currentSections: PremiumReportSectionRow[], baselineSections: PremiumReportSectionRow[]) {
  return Array.from({ length: Math.max(currentSections.length, baselineSections.length) }, (_, index) => {
    const current = currentSections[index];
    const baseline = baselineSections[index];
    if (current && !baseline) {
      return {
        key: `section-added-${index}`,
        label: `섹션 ${index + 1} 추가`,
        detail: current.title.trim() || current.key.trim() || "새 섹션",
      };
    }
    if (!current && baseline) {
      return {
        key: `section-removed-${index}`,
        label: `섹션 ${index + 1} 삭제`,
        detail: baseline.title.trim() || baseline.key.trim() || "기존 섹션",
      };
    }
    if (!current || !baseline) return null;
    const changedFields: string[] = [];
    if (normalizeDiffText(current.key) !== normalizeDiffText(baseline.key)) changedFields.push("키");
    if (normalizeDiffText(current.title) !== normalizeDiffText(baseline.title)) changedFields.push("제목");
    if (normalizeDiffText(current.body) !== normalizeDiffText(baseline.body)) changedFields.push("본문");
    if (changedFields.length === 0) return null;
    return {
      key: `section-updated-${index}`,
      label: `섹션 ${index + 1} 수정`,
      detail: `${current.title.trim() || baseline.title.trim() || `섹션 ${index + 1}`} · ${changedFields.join(", ")}`,
    };
  }).filter((item): item is { key: string; label: string; detail: string } => item != null);
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0B";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

function canApprovePremiumRequest(status: string, paymentStatus: string) {
  return (status === "requested" || status === "paid_pending") && paymentStatus === "confirmed";
}

function canConfirmPremiumPayment(status: string, paymentStatus: string) {
  return (status === "requested" || status === "paid_pending") && paymentStatus !== "confirmed";
}

function canStartPremiumRequest(status: string) {
  return status === "approved" || status === "in_progress";
}

function canReleasePremiumRequest(status: string, paymentStatus: string) {
  return (status === "approved" || status === "in_progress" || status === "ready") && paymentStatus === "confirmed";
}

function canRejectPremiumRequest(status: string) {
  return status !== "rejected" && status !== "expired";
}

function getPremiumActionMeta(meta: unknown) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  return meta as Record<string, unknown>;
}

function formatPremiumActionItem(row: PremiumReportActionRow): FormattedPremiumActionItem {
  const meta = getPremiumActionMeta(row.meta_json);
  const details: string[] = [];

  switch (row.action) {
    case "document_saved": {
      if (typeof meta.version === "number") details.push(`버전 ${meta.version}`);
      if (typeof meta.sectionCount === "number") details.push(`섹션 ${meta.sectionCount}개`);
      return {
        title: "문서 저장",
        details,
        targetDocumentVersion: typeof meta.version === "number" ? meta.version : null,
      };
    }
    case "pdf_published": {
      if (typeof meta.version === "number") details.push(`문서 버전 ${meta.version}`);
      if (typeof meta.bytes === "number") details.push(`파일 크기 ${formatFileSize(meta.bytes)}`);
      if (typeof meta.image_asset_count === "number") details.push(`이미지 ${meta.image_asset_count}개`);
      if (typeof meta.attachment_pdf_count === "number") details.push(`첨부 PDF ${meta.attachment_pdf_count}개`);
      return { title: "최종 PDF 발행", details };
    }
    case "asset_uploaded": {
      if (typeof meta.assetType === "string") details.push(getPremiumAssetTypeLabel(meta.assetType));
      if (typeof meta.fileName === "string" && meta.fileName.trim() !== "") details.push(meta.fileName);
      if (typeof meta.bytes === "number") details.push(formatFileSize(meta.bytes));
      return {
        title: "자산 업로드",
        details,
        targetAssetId: typeof meta.assetId === "string" ? meta.assetId : null,
      };
    }
    case "asset_meta_updated": {
      const patch = getPremiumActionMeta(meta.patch);
      const changed: string[] = [];
      if ("title" in patch) changed.push("제목");
      if ("description" in patch) changed.push("설명");
      if ("sortOrder" in patch) changed.push("순서");
      if ("isCover" in patch) changed.push(patch.isCover === true ? "대표 이미지 지정" : "대표 이미지 해제");
      if (changed.length > 0) details.push(changed.join(", "));
      return {
        title: "자산 메타 수정",
        details,
        targetAssetId: typeof meta.assetId === "string" ? meta.assetId : null,
      };
    }
    case "asset_deleted": {
      if (typeof meta.assetType === "string") details.push(getPremiumAssetTypeLabel(meta.assetType));
      if (typeof meta.originalName === "string" && meta.originalName.trim() !== "") details.push(meta.originalName);
      return { title: "자산 삭제", details };
    }
    case "assets_reordered": {
      if (Array.isArray(meta.assetIds)) details.push(`정렬 자산 ${meta.assetIds.length}개`);
      return { title: "자산 순서 변경", details };
    }
    case "status_changed": {
      if (typeof meta.status === "string") details.push(`상태 ${meta.status}`);
      if (typeof meta.payment_status === "string") details.push(`결제 ${meta.payment_status}`);
      if (typeof meta.downloadable === "boolean") {
        details.push(meta.downloadable ? "다운로드 허용" : "다운로드 비허용");
      }
      if (typeof meta.admin_note === "string" && meta.admin_note.trim() !== "") {
        details.push(`메모: ${compactPreviewText(meta.admin_note, 80)}`);
      }
      return { title: "신청 상태 변경", details };
    }
    default: {
      const metaText = compactPreviewText(JSON.stringify(meta), 120);
      if (metaText) details.push(metaText);
      return { title: row.action, details };
    }
  }
}

function resolvePremiumAssetPreviewText(
  assetType: string,
  meta: { title?: unknown; description?: unknown },
  draft?: PremiumAssetDraft | null
) {
  const title =
    (draft?.title ?? "").trim() ||
    (meta.title == null ? "" : String(meta.title).trim()) ||
    getPremiumAssetDefaultTitle(assetType);
  const description =
    (draft?.description ?? "").trim() || (meta.description == null ? "" : String(meta.description).trim());
  return { title, description };
}

function moveItemInArray<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function insertItemByDropPosition<T extends { id: string }>(
  items: T[],
  draggedId: string,
  targetId: string,
  position: "before" | "after"
) {
  const fromIndex = items.findIndex((item) => item.id === draggedId);
  const targetIndex = items.findIndex((item) => item.id === targetId);
  if (fromIndex < 0 || targetIndex < 0 || draggedId === targetId) return items;

  const withoutDragged = items.filter((item) => item.id !== draggedId);
  const nextTargetIndex = withoutDragged.findIndex((item) => item.id === targetId);
  if (nextTargetIndex < 0) return items;

  const insertIndex = position === "after" ? nextTargetIndex + 1 : nextTargetIndex;
  const dragged = items[fromIndex]!;
  const next = [...withoutDragged];
  next.splice(insertIndex, 0, dragged);
  return next;
}

function applyPremiumAssetOrder(
  allAssets: PremiumReportAssetRow[],
  orderedEditableIds: string[]
) {
  const editableMap = new Map(
    allAssets.filter((asset) => asset.asset_type !== "final_pdf").map((asset) => [asset.id, asset] as const)
  );
  const reorderedEditable: PremiumReportAssetRow[] = [];
  for (const [index, id] of orderedEditableIds.entries()) {
    const asset = editableMap.get(id);
    if (!asset) continue;
    const meta = getPremiumAssetMeta(asset.meta_json);
    reorderedEditable.push({
      ...asset,
      meta_json: {
        ...meta,
        sort_order: index,
      },
    });
  }

  const remainingEditable = allAssets
    .filter((asset) => asset.asset_type !== "final_pdf" && !orderedEditableIds.includes(asset.id))
    .map((asset, index) => {
      const meta = getPremiumAssetMeta(asset.meta_json);
      return {
        ...asset,
        meta_json: {
          ...meta,
          sort_order: reorderedEditable.length + index,
        },
      } satisfies PremiumReportAssetRow;
    });

  const finalAssets = allAssets.filter((asset) => asset.asset_type === "final_pdf");
  return [...reorderedEditable, ...remainingEditable, ...finalAssets];
}

/** 모더레이션 삭제(보관) 목록(API 응답) */
type QuarantineRow = {
  id: string;
  created_at: string;
  nickname: string;
  note: string;
  is_public: boolean;
  moderation_reason: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  purge_hold: boolean;
  purgeEligible: boolean;
};

function AdminExportForm() {
  const [dataType, setDataType] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [nickname, setNickname] = useState("");
  const [format, setFormat] = useState<"csv" | "xls">("csv");

  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ dataType, format });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (nickname) params.set("nickname", nickname);
      const res = await fetch(`/api/admin/export?${params.toString()}`);
      if (!res.ok) {
        alert("내보내기 실패");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="?([^";]+)"?/);
      const name = match ? match[1] : `awakening-export.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 space-y-2">
      <p className="text-xs font-medium text-slate-400">데이터 점검용 내보내기 (종류·기간·사용자·형식 선택)</p>
      <div className="flex flex-wrap gap-2 items-end">
        <label className="flex flex-col gap-0.5">
          <span className="text-[11px] text-slate-400">데이터 종류</span>
          <select
            value={dataType}
            onChange={(e) => setDataType(e.target.value)}
            className="rounded bg-slate-900 border border-slate-600 text-slate-200 text-xs px-2 py-1.5"
          >
            <option value="all">전체(기록+반응+키워드)</option>
            <option value="records">기록(awakenings)</option>
            <option value="reactions">반응(reactions)</option>
            <option value="keywords">키워드 요약</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[11px] text-slate-400">기간 시작(연월일)</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded bg-slate-900 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 w-36"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[11px] text-slate-400">기간 끝(연월일)</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded bg-slate-900 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 w-36"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[11px] text-slate-400">닉네임(선택)</span>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="전체"
            className="rounded bg-slate-900 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 w-24"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[11px] text-slate-400">형식</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as "csv" | "xls")}
            className="rounded bg-slate-900 border border-slate-600 text-slate-200 text-xs px-2 py-1.5"
          >
            <option value="csv">CSV</option>
            <option value="xls">XLS(엑셀)</option>
          </select>
        </label>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="px-3 py-1.5 rounded bg-electric-blue/80 text-white text-xs hover:bg-electric-blue disabled:opacity-50"
        >
          {exporting ? "다운로드 중..." : "내보내기"}
        </button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<AdminTab>("records");
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [aiContent, setAiContent] = useState<AiContentRow[]>([]);
  const [aiStats, setAiStats] = useState<Record<string, number>>({});
  const [aiTotal, setAiTotal] = useState(0);
  const [quarantineDays, setQuarantineDays] = useState(30);
  const [purgeCutoffIso, setPurgeCutoffIso] = useState("");
  const [moderationArchived, setModerationArchived] = useState<QuarantineRow[]>([]);
  const [mqLoading, setMqLoading] = useState(false);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [aiContentLoading, setAiContentLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editingNickname, setEditingNickname] = useState<string | null>(null);
  const [editHint, setEditHint] = useState("");
  const [backupLoading, setBackupLoading] = useState(false);
  const [entNick, setEntNick] = useState("");
  const [entLoading, setEntLoading] = useState(false);
  const [entRows, setEntRows] = useState<EntitlementRow[]>([]);
  const [entError, setEntError] = useState<string>("");
  const [entExpiresDate, setEntExpiresDate] = useState<string>("");
  const [imgReqItems, setImgReqItems] = useState<ImageEntitlementRequestRow[]>([]);
  const [imgReqLoading, setImgReqLoading] = useState(false);
  const [imgReqError, setImgReqError] = useState("");
  const [imgReqFilter, setImgReqFilter] = useState<"pending" | "all">("pending");
  const [imgReqActionId, setImgReqActionId] = useState<string | null>(null);
  const [auditNick, setAuditNick] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [entitlementActions, setEntitlementActions] = useState<EntitlementActionRow[]>([]);
  const [imageUsageRows, setImageUsageRows] = useState<ImageUsageRow[]>([]);
  const [imageAssetRows, setImageAssetRows] = useState<ImageAssetAuditRow[]>([]);
  const [premiumProducts, setPremiumProducts] = useState<PremiumReportProductRow[]>([]);
  const [premiumRequests, setPremiumRequests] = useState<PremiumReportRequestRow[]>([]);
  const [premiumLoading, setPremiumLoading] = useState(false);
  const [premiumError, setPremiumError] = useState("");
  const [eligCheckNick, setEligCheckNick] = useState("");
  const [eligCheckLoading, setEligCheckLoading] = useState(false);
  const [eligCheckError, setEligCheckError] = useState("");
  const [eligCheckResult, setEligCheckResult] = useState<PremiumEligibilityCheckResult | null>(null);
  const [eligRequestList, setEligRequestList] = useState<PremiumEligListItem[]>([]);
  const [eligListLoading, setEligListLoading] = useState(false);
  const [selectedEligRequestId, setSelectedEligRequestId] = useState<string | null>(null);
  const [premiumCoverInputKey, setPremiumCoverInputKey] = useState(0);
  const [selectedPremiumRequestId, setSelectedPremiumRequestId] = useState<string | null>(null);
  const [premiumDocLoading, setPremiumDocLoading] = useState(false);
  const [premiumDocError, setPremiumDocError] = useState("");
  const [premiumDocSaveBusy, setPremiumDocSaveBusy] = useState(false);
  const [premiumDocTitle, setPremiumDocTitle] = useState("");
  const [premiumDocSummary, setPremiumDocSummary] = useState("");
  const [premiumDocPageCount, setPremiumDocPageCount] = useState(4);
  const [premiumDocVersion, setPremiumDocVersion] = useState(0);
  const [premiumDocPdfStatus, setPremiumDocPdfStatus] = useState("draft");
  const [premiumDocSections, setPremiumDocSections] = useState<PremiumReportSectionRow[]>([]);
  const [premiumDocSnapshot, setPremiumDocSnapshot] = useState<unknown>(null);
  const [premiumDocAssets, setPremiumDocAssets] = useState<PremiumReportAssetRow[]>([]);
  const [premiumDocActions, setPremiumDocActions] = useState<PremiumReportActionRow[]>([]);
  const [premiumDocHistory, setPremiumDocHistory] = useState<PremiumReportDocumentRow[]>([]);
  const [premiumDocBaseline, setPremiumDocBaseline] = useState<PremiumDocBaseline | null>(null);
  const [premiumCompareVersion, setPremiumCompareVersion] = useState<number | null>(null);
  const [premiumDocPublishBusy, setPremiumDocPublishBusy] = useState(false);
  const [premiumRestoreBusy, setPremiumRestoreBusy] = useState(false);
  const [premiumHighlightedAssetId, setPremiumHighlightedAssetId] = useState<string | null>(null);
  const [premiumAssetType, setPremiumAssetType] = useState<PremiumUploadAssetType>("chart_image");
  const [premiumAssetFile, setPremiumAssetFile] = useState<File | null>(null);
  const [premiumAssetBusy, setPremiumAssetBusy] = useState(false);
  const [premiumAssetInputKey, setPremiumAssetInputKey] = useState(0);
  const [premiumAssetActionBusyId, setPremiumAssetActionBusyId] = useState<string | null>(null);
  const [premiumDraggedAssetId, setPremiumDraggedAssetId] = useState<string | null>(null);
  const [premiumDropTarget, setPremiumDropTarget] = useState<{
    assetId: string;
    position: "before" | "after";
  } | null>(null);
  const [premiumAssetDrafts, setPremiumAssetDrafts] = useState<Record<string, PremiumAssetDraft>>({});

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/records?limit=1");
      setLoggedIn(res.ok);
    } catch {
      setLoggedIn(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoginError(data.error ?? "로그인에 실패했습니다.");
      return;
    }
    setLoggedIn(true);
    setPassword("");
    loadRecords();
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setLoggedIn(false);
    setRecords([]);
    setMembers([]);
    setProfiles([]);
    setAiContent([]);
    setEntitlementActions([]);
    setImageUsageRows([]);
    setImageAssetRows([]);
    setPremiumDocActions([]);
    setPremiumDocHistory([]);
    setPremiumCompareVersion(null);
    setAuditError("");
  };

  const loadImageAudit = useCallback(async () => {
    setAuditLoading(true);
    setAuditError("");
    try {
      const params = new URLSearchParams({ limit: "50" });
      const n = auditNick.trim().toLowerCase();
      if (n) params.set("nickname", n);
      const res = await fetch(`/api/admin/image-audit?${params.toString()}`);
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        entitlement_actions?: EntitlementActionRow[];
        image_usage?: ImageUsageRow[];
        image_assets?: ImageAssetAuditRow[];
      };
      if (!res.ok) {
        setAuditError(json.error ?? "조회 실패");
        setEntitlementActions([]);
        setImageUsageRows([]);
        setImageAssetRows([]);
        return;
      }
      setEntitlementActions(Array.isArray(json.entitlement_actions) ? json.entitlement_actions : []);
      setImageUsageRows(Array.isArray(json.image_usage) ? json.image_usage : []);
      setImageAssetRows(Array.isArray(json.image_assets) ? json.image_assets : []);
    } catch {
      setAuditError("네트워크 오류");
      setEntitlementActions([]);
      setImageUsageRows([]);
      setImageAssetRows([]);
    } finally {
      setAuditLoading(false);
    }
  }, [auditNick]);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/members");
      if (!res.ok) throw new Error("회원 목록 조회 실패");
      const json = await res.json();
      setMembers(json.data ?? []);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/records?limit=50");
      if (!res.ok) throw new Error("목록 조회 실패");
      const json = await res.json();
      setRecords(json.data ?? []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProfiles = useCallback(async () => {
    setProfilesLoading(true);
    try {
      const res = await fetch("/api/admin/profiles");
      if (!res.ok) throw new Error("프로필 조회 실패");
      const json = await res.json();
      setProfiles(json.profiles ?? []);
    } catch {
      setProfiles([]);
    } finally {
      setProfilesLoading(false);
    }
  }, []);

  const loadAiContent = useCallback(async () => {
    setAiContentLoading(true);
    try {
      const res = await fetch("/api/admin/ai-content?limit=50");
      if (!res.ok) throw new Error("AI 콘텐츠 조회 실패");
      const json = await res.json();
      setAiContent(json.items ?? []);
      setAiStats(json.stats ?? {});
      setAiTotal(json.total ?? 0);
    } catch {
      setAiContent([]);
      setAiStats({});
      setAiTotal(0);
    } finally {
      setAiContentLoading(false);
    }
  }, []);

  const loadEntitlements = useCallback(async () => {
    setEntLoading(true);
    setEntError("");
    setEntRows([]);
    try {
      const n = entNick.trim().toLowerCase();
      if (!n) {
        setEntError("닉네임을 입력하세요.");
        return;
      }
      const res = await fetch(`/api/admin/entitlements?nickname=${encodeURIComponent(n)}`);
      const json = (await res.json().catch(() => ({}))) as {
        rows?: EntitlementRow[];
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        const msg = [json.error ?? "조회 실패", json.hint].filter(Boolean).join("\n");
        setEntError(msg);
        return;
      }
      setEntRows(Array.isArray(json.rows) ? json.rows : []);
    } catch {
      setEntError("네트워크 오류");
    } finally {
      setEntLoading(false);
    }
  }, [entNick]);

  const loadPremiumEligibilityList = useCallback(async () => {
    setEligListLoading(true);
    setEligCheckError("");
    try {
      const res = await fetch("/api/admin/premium-report/eligibility/list");
      const json = (await res.json().catch(() => ({}))) as { items?: PremiumEligListItem[]; error?: string };
      if (!res.ok) {
        setEligCheckError(json.error ?? "신청 목록을 불러오지 못했습니다.");
        setEligRequestList([]);
        return;
      }
      setEligRequestList(Array.isArray(json.items) ? json.items : []);
    } catch {
      setEligCheckError("네트워크 오류");
      setEligRequestList([]);
    } finally {
      setEligListLoading(false);
    }
  }, []);

  const loadPremiumEligibilityCheck = useCallback(async (nicknameOverride?: string) => {
    const nick = (nicknameOverride ?? eligCheckNick).trim();
    if (!nick) {
      setEligCheckError("닉네임을 입력하세요.");
      setEligCheckResult(null);
      return;
    }
    setEligCheckLoading(true);
    setEligCheckError("");
    setEligCheckResult(null);
    try {
      const res = await fetch(`/api/admin/premium-report/eligibility?nickname=${encodeURIComponent(nick)}`);
      const json = (await res.json().catch(() => ({}))) as PremiumEligibilityCheckResult & { error?: string };
      if (!res.ok) {
        setEligCheckError(String(json.error ?? "자격 조회 실패"));
        return;
      }
      setEligCheckResult(json);
    } catch {
      setEligCheckError("네트워크 오류");
    } finally {
      setEligCheckLoading(false);
    }
  }, [eligCheckNick]);

  const selectEligibilityListItem = useCallback(
    (item: PremiumEligListItem) => {
      setSelectedEligRequestId(item.requestId);
      setEligCheckNick(item.nickname);
      void loadPremiumEligibilityCheck(item.nickname);
    },
    [loadPremiumEligibilityCheck]
  );

  const loadPremiumReports = useCallback(async () => {
    setPremiumLoading(true);
    setPremiumError("");
    try {
      const [productsRes, requestsRes] = await Promise.all([
        fetch("/api/admin/premium-report/products"),
        fetch("/api/admin/premium-report/requests"),
      ]);
      const productsJson = (await productsRes.json().catch(() => ({}))) as {
        items?: PremiumReportProductRow[];
        error?: string;
      };
      const requestsJson = (await requestsRes.json().catch(() => ({}))) as {
        items?: PremiumReportRequestRow[];
        error?: string;
      };

      if (!productsRes.ok) {
        setPremiumError(productsJson.error ?? "유료 보고서 상품 조회 실패");
        setPremiumProducts([]);
      } else {
        setPremiumProducts(Array.isArray(productsJson.items) ? productsJson.items : []);
      }

      if (!requestsRes.ok) {
        setPremiumError((prev) => prev || requestsJson.error || "유료 보고서 신청 조회 실패");
        setPremiumRequests([]);
      } else {
        setPremiumRequests(Array.isArray(requestsJson.items) ? requestsJson.items : []);
      }
    } catch {
      setPremiumError("네트워크 오류");
      setPremiumProducts([]);
      setPremiumRequests([]);
    } finally {
      setPremiumLoading(false);
    }
  }, []);

  const savePremiumProduct = useCallback(
    async (row: PremiumReportProductRow, patch: Partial<PremiumReportProductRow>) => {
      setPremiumLoading(true);
      setPremiumError("");
      try {
        const res = await fetch("/api/admin/premium-report/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: row.code,
            name: patch.name ?? row.name,
            description: patch.description ?? row.description,
            defaultPages: patch.default_pages ?? row.default_pages,
            sections: Array.isArray(row.sections_json) ? row.sections_json : [],
            active: patch.active ?? row.active,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) {
          setPremiumError(json.error ?? "상품 저장 실패");
          return;
        }
        await loadPremiumReports();
      } catch {
        setPremiumError("네트워크 오류");
      } finally {
        setPremiumLoading(false);
      }
    },
    [loadPremiumReports]
  );

  const updatePremiumRequestStatus = useCallback(
    async (id: string, patch: { status?: string; paymentStatus?: string; downloadable?: boolean; adminNote?: string | null }) => {
      setPremiumLoading(true);
      setPremiumError("");
      try {
        const res = await fetch(`/api/admin/premium-report/requests/${id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) {
          setPremiumError(json.error ?? "상태 변경 실패");
          return;
        }
        await loadPremiumReports();
      } catch {
        setPremiumError("네트워크 오류");
      } finally {
        setPremiumLoading(false);
      }
    },
    [loadPremiumReports]
  );

  const loadPremiumDocument = useCallback(async (requestId: string) => {
    setPremiumDocLoading(true);
    setPremiumDocError("");
    try {
      const res = await fetch(`/api/admin/premium-report/requests/${requestId}/document`);
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        document?: PremiumReportDocumentRow | null;
        snapshot?: unknown;
        assets?: PremiumReportAssetRow[];
        actions?: PremiumReportActionRow[];
        history?: PremiumReportDocumentRow[];
      };
      if (!res.ok) {
        setPremiumDocError(json.error ?? "문서 불러오기 실패");
        return;
      }
      const doc = json.document;
      setSelectedPremiumRequestId(requestId);
      setPremiumDocSnapshot(json.snapshot ?? null);
      setPremiumDocTitle(doc?.title ?? "나의 자깨 감응 보고서");
      setPremiumDocSummary(doc?.summary_text ?? "");
      setPremiumDocPageCount(doc?.page_count ?? 4);
      setPremiumDocVersion(doc?.version ?? 0);
      setPremiumDocPdfStatus(doc?.pdf_status ?? "draft");
      setPremiumDocSections(Array.isArray(doc?.sections_json) ? doc!.sections_json : []);
      const assets = Array.isArray(json.assets) ? json.assets : [];
      const history = Array.isArray(json.history) ? json.history : doc ? [doc] : [];
      setPremiumDocAssets(assets);
      setPremiumDocActions(Array.isArray(json.actions) ? json.actions : []);
      setPremiumDocHistory(history);
      setPremiumCompareVersion(history[0]?.version ?? null);
      const assetDraftMap = Object.fromEntries(
        assets.map((asset) => {
          const meta = getPremiumAssetMeta(asset.meta_json);
          return [
            asset.id,
            {
              title: meta.title == null ? "" : String(meta.title),
              description: meta.description == null ? "" : String(meta.description),
            },
          ] satisfies [string, PremiumAssetDraft];
        })
      );
      setPremiumAssetDrafts(assetDraftMap);
      setPremiumDocBaseline({
        title: doc?.title ?? "나의 자깨 감응 보고서",
        summary: doc?.summary_text ?? "",
        pageCount: doc?.page_count ?? 4,
        sections: Array.isArray(doc?.sections_json) ? doc!.sections_json : [],
        assetDrafts: assetDraftMap,
      });
      setPremiumAssetFile(null);
      setPremiumHighlightedAssetId(null);
      setPremiumAssetInputKey((prev) => prev + 1);
    } catch {
      setPremiumDocError("네트워크 오류");
    } finally {
      setPremiumDocLoading(false);
    }
  }, []);

  const persistPremiumDocumentVersion = useCallback(async () => {
    if (!selectedPremiumRequestId) {
      return { ok: false as const, error: "선택된 신청이 없습니다." };
    }

    const res = await fetch(`/api/admin/premium-report/requests/${selectedPremiumRequestId}/document`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: premiumDocTitle,
        summaryText: premiumDocSummary,
        pageCount: premiumDocPageCount,
        sections: premiumDocSections,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; version?: number; pdfStatus?: string };
    if (!res.ok || !json.ok) {
      return { ok: false as const, error: json.error ?? "문서 저장 실패" };
    }
    return {
      ok: true as const,
      version: json.version ?? premiumDocVersion,
      pdfStatus: json.pdfStatus ?? "draft",
    };
  }, [
    selectedPremiumRequestId,
    premiumDocPageCount,
    premiumDocSections,
    premiumDocSummary,
    premiumDocTitle,
    premiumDocVersion,
  ]);

  const savePremiumDocument = useCallback(async () => {
    if (!selectedPremiumRequestId) return;
    setPremiumDocSaveBusy(true);
    setPremiumDocError("");
    try {
      const result = await persistPremiumDocumentVersion();
      if (!result.ok) {
        setPremiumDocError(result.error);
        return;
      }
      setPremiumDocVersion(result.version);
      setPremiumDocPdfStatus(result.pdfStatus);
      await loadPremiumReports();
      await loadPremiumDocument(selectedPremiumRequestId);
    } catch {
      setPremiumDocError("네트워크 오류");
    } finally {
      setPremiumDocSaveBusy(false);
    }
  }, [
    selectedPremiumRequestId,
    loadPremiumReports,
    loadPremiumDocument,
    persistPremiumDocumentVersion,
  ]);

  const publishPremiumDocument = useCallback(async () => {
    if (!selectedPremiumRequestId) return;
    const hasUnsavedDocChangesNow = premiumDocBaseline
      ? normalizeDiffText(premiumDocTitle) !== normalizeDiffText(premiumDocBaseline.title) ||
        normalizeDiffText(premiumDocSummary) !== normalizeDiffText(premiumDocBaseline.summary) ||
        premiumDocPageCount !== premiumDocBaseline.pageCount ||
        buildPremiumSectionDiffs(premiumDocSections, premiumDocBaseline.sections).length > 0
      : false;
    const hasUnsavedAssetDraftChangesNow = premiumDocBaseline
      ? premiumDocAssets
          .filter((asset) => asset.asset_type !== "final_pdf")
          .some((asset) => {
            const baselineDraft = premiumDocBaseline.assetDrafts[asset.id] ?? { title: "", description: "" };
            const currentDraft = premiumAssetDrafts[asset.id] ?? { title: "", description: "" };
            return (
              normalizeDiffText(currentDraft.title) !== normalizeDiffText(baselineDraft.title) ||
              normalizeDiffText(currentDraft.description) !== normalizeDiffText(baselineDraft.description)
            );
          })
      : false;

    if (hasUnsavedDocChangesNow || hasUnsavedAssetDraftChangesNow) {
      setPremiumDocError("미저장 변경이 있습니다. 문서/설명 저장 후 다시 발행해 주세요.");
      return;
    }

    setPremiumDocPublishBusy(true);
    setPremiumDocError("");
    try {
      const res = await fetch(`/api/admin/premium-report/requests/${selectedPremiumRequestId}/publish`, {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setPremiumDocError(json.error ?? "최종 PDF 발행 실패");
        return;
      }
      setPremiumDocPdfStatus("ready");
      await loadPremiumDocument(selectedPremiumRequestId);
    } catch {
      setPremiumDocError("네트워크 오류");
    } finally {
      setPremiumDocPublishBusy(false);
    }
  }, [
    selectedPremiumRequestId,
    premiumDocBaseline,
    premiumDocTitle,
    premiumDocSummary,
    premiumDocPageCount,
    premiumDocSections,
    premiumDocAssets,
    premiumAssetDrafts,
    loadPremiumDocument,
  ]);

  const uploadPremiumAsset = useCallback(async () => {
    if (!selectedPremiumRequestId || !premiumAssetFile) return;
    setPremiumAssetBusy(true);
    setPremiumDocError("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") resolve(reader.result);
          else reject(new Error("파일을 읽을 수 없습니다."));
        };
        reader.onerror = () => reject(new Error("파일 읽기 중 오류가 발생했습니다."));
        reader.readAsDataURL(premiumAssetFile);
      });

      const res = await fetch(`/api/admin/premium-report/requests/${selectedPremiumRequestId}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetType: premiumAssetType,
          fileName: premiumAssetFile.name,
          mimeType: premiumAssetFile.type,
          base64,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setPremiumDocError(json.error ?? "자산 업로드 실패");
        return;
      }

      setPremiumAssetFile(null);
      setPremiumAssetInputKey((prev) => prev + 1);
      await loadPremiumDocument(selectedPremiumRequestId);
    } catch (error) {
      setPremiumDocError(error instanceof Error ? error.message : "네트워크 오류");
    } finally {
      setPremiumAssetBusy(false);
    }
  }, [selectedPremiumRequestId, premiumAssetFile, premiumAssetType, loadPremiumDocument]);

  const updatePremiumAssetMeta = useCallback(
    async (assetId: string, patch: { sortOrder?: number; isCover?: boolean; title?: string; description?: string }) => {
      if (!selectedPremiumRequestId) return;
      setPremiumAssetActionBusyId(assetId);
      setPremiumDocError("");
      try {
        const res = await fetch(`/api/admin/premium-report/requests/${selectedPremiumRequestId}/assets/${assetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) {
          setPremiumDocError(json.error ?? "자산 수정 실패");
          return;
        }
        await loadPremiumDocument(selectedPremiumRequestId);
      } catch {
        setPremiumDocError("네트워크 오류");
      } finally {
        setPremiumAssetActionBusyId(null);
      }
    },
    [selectedPremiumRequestId, loadPremiumDocument]
  );

  const savePremiumAssetDraft = useCallback(
    async (assetId: string) => {
      const draft = premiumAssetDrafts[assetId];
      if (!draft) return;
      await updatePremiumAssetMeta(assetId, {
        title: draft.title,
        description: draft.description,
      });
    },
    [premiumAssetDrafts, updatePremiumAssetMeta]
  );

  const focusPremiumAssetCard = useCallback((assetId: string) => {
    setPremiumHighlightedAssetId(assetId);
    const element = document.getElementById(`premium-asset-${assetId}`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      setPremiumHighlightedAssetId((current) => (current === assetId ? null : current));
    }, 2200);
  }, []);

  const restorePremiumCompareDocumentToDraft = useCallback(() => {
    const compareDoc =
      premiumCompareVersion == null ? null : premiumDocHistory.find((item) => item.version === premiumCompareVersion) ?? null;
    if (!compareDoc) return;

    const currentSectionsText = JSON.stringify(
      premiumDocSections.map((section) => ({
        key: normalizeDiffText(section.key),
        title: normalizeDiffText(section.title),
        body: normalizeDiffText(section.body),
      }))
    );
    const selectedSectionsText = JSON.stringify(
      (compareDoc.sections_json ?? []).map((section) => ({
        key: normalizeDiffText(section.key),
        title: normalizeDiffText(section.title),
        body: normalizeDiffText(section.body),
      }))
    );

    const hasCurrentDraftChanges =
      normalizeDiffText(premiumDocTitle) !== normalizeDiffText(compareDoc.title) ||
      normalizeDiffText(premiumDocSummary) !== normalizeDiffText(compareDoc.summary_text ?? "") ||
      premiumDocPageCount !== compareDoc.page_count ||
      currentSectionsText !== selectedSectionsText;

    if (
      hasCurrentDraftChanges &&
      !confirm(
        `v${compareDoc.version} 내용을 현재 편집기에 불러올까요?\n아직 저장하지 않은 현재 초안 내용은 화면에서 교체되며, 저장해야 새 버전으로 반영됩니다.`
      )
    ) {
      return;
    }

    setPremiumDocError("");
    setPremiumDocTitle(compareDoc.title);
    setPremiumDocSummary(compareDoc.summary_text ?? "");
    setPremiumDocPageCount(compareDoc.page_count);
    setPremiumDocSections((compareDoc.sections_json ?? []).map((section) => ({ ...section })));
  }, [premiumCompareVersion, premiumDocHistory, premiumDocPageCount, premiumDocSections, premiumDocSummary, premiumDocTitle]);

  const backupAndRestorePremiumCompareDocumentToDraft = useCallback(async () => {
    const compareDoc =
      premiumCompareVersion == null ? null : premiumDocHistory.find((item) => item.version === premiumCompareVersion) ?? null;
    if (!compareDoc || !selectedPremiumRequestId) return;

    const currentSectionsText = JSON.stringify(
      premiumDocSections.map((section) => ({
        key: normalizeDiffText(section.key),
        title: normalizeDiffText(section.title),
        body: normalizeDiffText(section.body),
      }))
    );
    const selectedSectionsText = JSON.stringify(
      (compareDoc.sections_json ?? []).map((section) => ({
        key: normalizeDiffText(section.key),
        title: normalizeDiffText(section.title),
        body: normalizeDiffText(section.body),
      }))
    );

    const hasCurrentDraftChanges =
      normalizeDiffText(premiumDocTitle) !== normalizeDiffText(compareDoc.title) ||
      normalizeDiffText(premiumDocSummary) !== normalizeDiffText(compareDoc.summary_text ?? "") ||
      premiumDocPageCount !== compareDoc.page_count ||
      currentSectionsText !== selectedSectionsText;

    if (!hasCurrentDraftChanges) {
      restorePremiumCompareDocumentToDraft();
      return;
    }

    if (
      !confirm(
        `현재 문서 초안을 새 버전으로 먼저 백업 저장한 뒤, v${compareDoc.version} 내용을 편집기에 불러올까요?\n자산 제목/설명 draft는 별도 저장 대상이므로 이 백업에는 포함되지 않습니다.`
      )
    ) {
      return;
    }

    setPremiumRestoreBusy(true);
    setPremiumDocError("");

    try {
      const restoreTarget = {
        ...compareDoc,
        sections_json: (compareDoc.sections_json ?? []).map((section) => ({ ...section })),
      };
      const result = await persistPremiumDocumentVersion();
      if (!result.ok) {
        setPremiumDocError(result.error);
        return;
      }

      setPremiumDocVersion(result.version);
      setPremiumDocPdfStatus(result.pdfStatus);
      await loadPremiumReports();
      await loadPremiumDocument(selectedPremiumRequestId);
      setPremiumCompareVersion(restoreTarget.version);
      setPremiumDocTitle(restoreTarget.title);
      setPremiumDocSummary(restoreTarget.summary_text ?? "");
      setPremiumDocPageCount(restoreTarget.page_count);
      setPremiumDocSections(restoreTarget.sections_json);
    } catch {
      setPremiumDocError("네트워크 오류");
    } finally {
      setPremiumRestoreBusy(false);
    }
  }, [
    loadPremiumDocument,
    loadPremiumReports,
    persistPremiumDocumentVersion,
    premiumCompareVersion,
    premiumDocHistory,
    premiumDocPageCount,
    premiumDocSections,
    premiumDocSummary,
    premiumDocTitle,
    restorePremiumCompareDocumentToDraft,
    selectedPremiumRequestId,
  ]);

  const uploadPremiumCoverImage = useCallback(
    async (file: File, replaceAssetId?: string | null) => {
      if (!selectedPremiumRequestId) {
        setPremiumDocError("먼저 유료 보고서 신청 건을 선택해 주세요.");
        return;
      }
      setPremiumAssetBusy(true);
      setPremiumDocError("");
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") resolve(reader.result);
            else reject(new Error("파일을 읽을 수 없습니다."));
          };
          reader.onerror = () => reject(new Error("파일 읽기 중 오류"));
          reader.readAsDataURL(file);
        });

        const res = await fetch(`/api/admin/premium-report/requests/${selectedPremiumRequestId}/assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assetType: "attachment_image",
            fileName: file.name,
            mimeType: file.type,
            base64,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; asset?: { id?: string } };
        if (!res.ok || !json.ok) {
          setPremiumDocError(json.error ?? "대표 이미지 업로드 실패");
          return;
        }
        const newAssetId = json.asset?.id;
        if (newAssetId) {
          await updatePremiumAssetMeta(newAssetId, { isCover: true });
        }
        if (replaceAssetId && replaceAssetId !== newAssetId) {
          const delRes = await fetch(
            `/api/admin/premium-report/requests/${selectedPremiumRequestId}/assets/${replaceAssetId}`,
            { method: "DELETE" }
          );
          const delJson = (await delRes.json().catch(() => ({}))) as { ok?: boolean };
          if (!delRes.ok || !delJson.ok) {
            setPremiumDocError("새 이미지는 등록됐으나 이전 대표 이미지 삭제에 실패했습니다.");
          }
        }
        setPremiumCoverInputKey((prev) => prev + 1);
        await loadPremiumDocument(selectedPremiumRequestId);
      } catch (error) {
        setPremiumDocError(error instanceof Error ? error.message : "네트워크 오류");
      } finally {
        setPremiumAssetBusy(false);
      }
    },
    [selectedPremiumRequestId, loadPremiumDocument, updatePremiumAssetMeta]
  );

  const deletePremiumAsset = useCallback(
    async (assetId: string) => {
      if (!selectedPremiumRequestId) return;
      if (!confirm("이 자산을 삭제할까요? 스토리지 파일도 함께 제거됩니다.")) return;
      setPremiumAssetActionBusyId(assetId);
      setPremiumDocError("");
      try {
        const res = await fetch(`/api/admin/premium-report/requests/${selectedPremiumRequestId}/assets/${assetId}`, {
          method: "DELETE",
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) {
          setPremiumDocError(json.error ?? "자산 삭제 실패");
          return;
        }
        await loadPremiumDocument(selectedPremiumRequestId);
      } catch {
        setPremiumDocError("네트워크 오류");
      } finally {
        setPremiumAssetActionBusyId(null);
      }
    },
    [selectedPremiumRequestId, loadPremiumDocument]
  );

  const reorderPremiumAssetList = useCallback(
    async (orderedAssetIds: string[], busyAssetId?: string) => {
      if (!selectedPremiumRequestId) return;
      setPremiumAssetActionBusyId(busyAssetId ?? orderedAssetIds[0] ?? null);
      setPremiumDocError("");
      setPremiumDocAssets((prev) => applyPremiumAssetOrder(prev, orderedAssetIds));
      try {
        const res = await fetch(`/api/admin/premium-report/requests/${selectedPremiumRequestId}/assets/reorder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetIds: orderedAssetIds }),
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) {
          setPremiumDocError(json.error ?? "자산 정렬 변경 실패");
          await loadPremiumDocument(selectedPremiumRequestId);
          return;
        }

        await loadPremiumDocument(selectedPremiumRequestId);
      } catch {
        setPremiumDocError("네트워크 오류");
      } finally {
        setPremiumAssetActionBusyId(null);
      }
    },
    [selectedPremiumRequestId, loadPremiumDocument]
  );

  const setEntitlement = useCallback(
    async (featureKey: EntitlementRow["feature_key"], enabled: boolean) => {
      setEntLoading(true);
      setEntError("");
      try {
        const n = entNick.trim().toLowerCase();
        if (!n) {
          setEntError("닉네임을 입력하세요.");
          return;
        }
        const res = await fetch("/api/admin/entitlements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nickname: n,
            feature_key: featureKey,
            enabled,
            source: "admin",
            enabled_by: "admin",
            // 날짜만 입력하면 KST 23:59:59로 만료 처리
            expires_at: entExpiresDate ? `${entExpiresDate}T23:59:59+09:00` : null,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; hint?: string };
        if (!res.ok || !json.ok) {
          const msg = [json.error ?? "저장 실패", json.hint].filter(Boolean).join("\n");
          setEntError(msg);
          return;
        }
        await loadEntitlements();
      } catch {
        setEntError("네트워크 오류");
      } finally {
        setEntLoading(false);
      }
    },
    [entNick, entExpiresDate, loadEntitlements]
  );

  const loadImageEntitlementRequests = useCallback(async () => {
    setImgReqLoading(true);
    setImgReqError("");
    try {
      const res = await fetch(
        `/api/admin/image-entitlement-requests?status=${encodeURIComponent(imgReqFilter)}&limit=80`
      );
      const json = (await res.json().catch(() => ({}))) as {
        items?: ImageEntitlementRequestRow[];
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        setImgReqError([json.error, json.hint].filter(Boolean).join("\n") || "목록 불러오기 실패");
        setImgReqItems([]);
        return;
      }
      setImgReqItems(Array.isArray(json.items) ? json.items : []);
    } catch {
      setImgReqError("네트워크 오류");
      setImgReqItems([]);
    } finally {
      setImgReqLoading(false);
    }
  }, [imgReqFilter]);

  const patchImageEntitlementRequest = useCallback(
    async (id: string, action: "mark_paid" | "waive_payment" | "approve" | "reject") => {
      setImgReqActionId(id);
      setImgReqError("");
      try {
        const res = await fetch(`/api/admin/image-entitlement-requests/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) {
          setImgReqError(json.error ?? "처리 실패");
          return;
        }
        await loadImageEntitlementRequests();
        if (entNick.trim()) await loadEntitlements();
      } catch {
        setImgReqError("네트워크 오류");
      } finally {
        setImgReqActionId(null);
      }
    },
    [loadImageEntitlementRequests, entNick, loadEntitlements]
  );

  const loadModerationArchive = useCallback(async () => {
    setMqLoading(true);
    try {
      const res = await fetch("/api/admin/moderation-quarantine");
      if (!res.ok) throw new Error("보관 목록 조회 실패");
      const json = await res.json();
      setQuarantineDays(typeof json.quarantineDays === "number" ? json.quarantineDays : 30);
      setPurgeCutoffIso(typeof json.purgeCutoffIso === "string" ? json.purgeCutoffIso : "");
      setModerationArchived(Array.isArray(json.items) ? json.items : []);
    } catch {
      setModerationArchived([]);
    } finally {
      setMqLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loggedIn === true) loadRecords();
  }, [loggedIn, loadRecords]);

  useEffect(() => {
    if (loggedIn === true && tab === "members") loadMembers();
  }, [loggedIn, tab, loadMembers]);

  useEffect(() => {
    if (loggedIn === true && tab === "profiles") loadProfiles();
  }, [loggedIn, tab, loadProfiles]);

  useEffect(() => {
    if (loggedIn === true && tab === "ai_content") loadAiContent();
  }, [loggedIn, tab, loadAiContent]);

  useEffect(() => {
    if (loggedIn === true && tab === "entitlements") {
      void loadImageEntitlementRequests();
      if (entNick.trim()) loadEntitlements();
      else {
        setEntRows([]);
        setEntError("");
      }
    }
  }, [loggedIn, tab, entNick, imgReqFilter, loadEntitlements, loadImageEntitlementRequests]);

  useEffect(() => {
    if (loggedIn === true && tab === "moderation_quarantine") loadModerationArchive();
  }, [loggedIn, tab, loadModerationArchive]);

  useEffect(() => {
    if (loggedIn === true && tab === "image_audit") loadImageAudit();
  }, [loggedIn, tab, loadImageAudit]);

  useEffect(() => {
    if (loggedIn === true && tab === "premium_reports") loadPremiumReports();
    if (loggedIn === true && tab === "premium_eligibility") {
      setEligCheckResult(null);
      setEligCheckError("");
      loadPremiumEligibilityList();
    }
  }, [loggedIn, tab, loadPremiumReports, loadPremiumEligibilityList]);

  const handleDelete = async (id: string) => {
    if (!confirm("이 기록을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/admin/records/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert((await res.json().catch(() => ({}))).error ?? "삭제 실패");
      return;
    }
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const startEdit = (r: RecordRow) => {
    setEditingId(r.id);
    setEditNote(r.note);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const res = await fetch(`/api/admin/records/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: editNote }),
    });
    if (!res.ok) {
      alert((await res.json().catch(() => ({}))).error ?? "수정 실패");
      return;
    }
    setRecords((prev) =>
      prev.map((r) => (r.id === editingId ? { ...r, note: editNote } : r))
    );
    setEditingId(null);
    setEditNote("");
  };

  const handleBackupDownload = async () => {
    setBackupLoading(true);
    try {
      const res = await fetch("/api/admin/backup");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "백업 조회 실패");
        return;
      }
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `awakening-backup-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("백업 다운로드 중 오류가 났습니다.");
    } finally {
      setBackupLoading(false);
    }
  };

  const handlePurgeModerationArchive = async () => {
    const n = moderationArchived.filter((r) => r.purgeEligible).length;
    if (
      !confirm(
        `폐기 가능 건 ${n}건을 DB에서 완전 삭제합니다. (보관 ${quarantineDays}일 경과·유보 아님·반응 등은 연쇄 삭제될 수 있음) 계속할까요?`
      )
    ) {
      return;
    }
    setPurgeBusy(true);
    try {
      const res = await fetch("/api/admin/moderation-purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "폐기 실패");
        return;
      }
      alert(`완료: ${data.purgedCount ?? 0}건 폐기 (후보 ${data.candidateCount ?? 0}건)`);
      await loadModerationArchive();
    } finally {
      setPurgeBusy(false);
    }
  };

  const handleTogglePurgeHold = async (id: string, nextHold: boolean) => {
    const res = await fetch(`/api/admin/moderation-quarantine/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purge_hold: nextHold }),
    });
    if (!res.ok) {
      alert((await res.json().catch(() => ({}))).error ?? "유보 설정 실패");
      return;
    }
    const cutoffMs = Date.now() - quarantineDays * 86400000;
    setModerationArchived((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const dt = r.deleted_at ? new Date(r.deleted_at).getTime() : 0;
        return {
          ...r,
          purge_hold: nextHold,
          purgeEligible:
            !nextHold && r.deleted_at != null && dt <= cutoffMs,
        };
      })
    );
  };

  const handleSaveHint = async () => {
    if (!editingNickname) return;
    const res = await fetch(`/api/admin/members/${encodeURIComponent(editingNickname)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password_hint: editHint || null }),
    });
    if (!res.ok) {
      alert((await res.json().catch(() => ({}))).error ?? "수정 실패");
      return;
    }
    setMembers((prev) =>
      prev.map((m) =>
        m.nickname === editingNickname ? { ...m, password_hint: editHint || null } : m
      )
    );
    setEditingNickname(null);
    setEditHint("");
  };

  if (loggedIn === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        확인 중...
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="w-full max-w-xs space-y-4">
          <h1 className="text-xl font-bold text-slate-200">관리자 로그인</h1>
          <p className="text-xs text-slate-500">
            미풍양속·욕설·비방·협박 등 문제 기록 삭제/수정용. 공정한 운영을 위해 조치 내역은 DB에 로그됩니다.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="관리자 비밀번호"
            className="w-full px-3 py-2 min-h-[44px] rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 text-base touch-manipulation"
            autoComplete="current-password"
          />
          {loginError && (
            <p className="text-sm text-red-400">{loginError}</p>
          )}
          <button
            type="submit"
            className="w-full min-h-[44px] py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 touch-manipulation"
          >
            로그인
          </button>
        </form>
      </div>
    );
  }

  const selectedPremiumRequest = premiumRequests.find((item) => item.id === selectedPremiumRequestId) ?? null;
  const editablePremiumAssets = premiumDocAssets.filter((asset) => asset.asset_type !== "final_pdf");
  const draggedPremiumAsset = premiumDraggedAssetId
    ? editablePremiumAssets.find((asset) => asset.id === premiumDraggedAssetId) ?? null
    : null;
  const premiumPreviewCoverAsset =
    editablePremiumAssets.find((asset) => {
      if (asset.asset_type !== "chart_image" && asset.asset_type !== "attachment_image") return false;
      return getPremiumAssetMeta(asset.meta_json).is_cover === true;
    }) ??
    editablePremiumAssets.find((asset) => asset.asset_type === "chart_image" || asset.asset_type === "attachment_image") ??
    null;
  const premiumPreviewCoverMeta = premiumPreviewCoverAsset ? getPremiumAssetMeta(premiumPreviewCoverAsset.meta_json) : null;
  const premiumPreviewCoverDraft = premiumPreviewCoverAsset ? premiumAssetDrafts[premiumPreviewCoverAsset.id] : null;
  const premiumPreviewCoverTitle = premiumPreviewCoverAsset
    ? resolvePremiumAssetPreviewText(
        premiumPreviewCoverAsset.asset_type,
        premiumPreviewCoverMeta ?? {},
        premiumPreviewCoverDraft
      ).title
    : "";
  const premiumPreviewCoverDescription = premiumPreviewCoverAsset
    ? resolvePremiumAssetPreviewText(
        premiumPreviewCoverAsset.asset_type,
        premiumPreviewCoverMeta ?? {},
        premiumPreviewCoverDraft
      ).description
    : "";
  const premiumPreviewSections = premiumDocSections.filter(
    (section) => section.title.trim() !== "" || section.body.trim() !== ""
  );
  const premiumPreviewHiddenSectionCount = Math.max(0, premiumPreviewSections.length - 6);
  const premiumPreviewAttachmentPdfCount = editablePremiumAssets.filter((asset) => asset.asset_type === "attachment_pdf").length;
  const premiumPreviewImageCount = editablePremiumAssets.filter(
    (asset) => asset.asset_type === "chart_image" || asset.asset_type === "attachment_image"
  ).length;
  const premiumPreviewVisualAssets = editablePremiumAssets
    .filter(
      (asset) =>
        (asset.asset_type === "chart_image" || asset.asset_type === "attachment_image") &&
        asset.id !== premiumPreviewCoverAsset?.id
    )
    .map((asset) => {
      const meta = getPremiumAssetMeta(asset.meta_json);
      const resolved = resolvePremiumAssetPreviewText(asset.asset_type, meta, premiumAssetDrafts[asset.id]);
      return {
        id: asset.id,
        title: resolved.title,
        description: resolved.description,
        downloadUrl: asset.download_url ?? null,
        assetType: asset.asset_type,
      };
    });
  const premiumPreviewAttachmentAssets = editablePremiumAssets
    .filter((asset) => asset.asset_type === "attachment_pdf")
    .map((asset) => {
      const meta = getPremiumAssetMeta(asset.meta_json);
      const resolved = resolvePremiumAssetPreviewText(asset.asset_type, meta, premiumAssetDrafts[asset.id]);
      return {
        id: asset.id,
        title: resolved.title,
        description: resolved.description,
        originalName: meta.original_name == null ? "" : String(meta.original_name),
      };
    });
  const premiumPreviewSectionPages = Array.from(
    { length: Math.ceil(premiumPreviewSections.length / 2) },
    (_, index) => premiumPreviewSections.slice(index * 2, index * 2 + 2)
  );
  const selectedCompareDocument =
    premiumCompareVersion == null ? null : premiumDocHistory.find((item) => item.version === premiumCompareVersion) ?? null;
  const selectedCompareSections = selectedCompareDocument?.sections_json ?? [];
  const selectedCompareHiddenSectionCount = Math.max(0, selectedCompareSections.length - 6);
  const selectedCompareSectionPages = Array.from(
    { length: Math.ceil(selectedCompareSections.length / 2) },
    (_, index) => selectedCompareSections.slice(index * 2, index * 2 + 2)
  );
  const premiumDocTitleChanged = premiumDocBaseline
    ? normalizeDiffText(premiumDocTitle) !== normalizeDiffText(premiumDocBaseline.title)
    : false;
  const premiumDocSummaryChanged = premiumDocBaseline
    ? normalizeDiffText(premiumDocSummary) !== normalizeDiffText(premiumDocBaseline.summary)
    : false;
  const premiumDocPageCountChanged = premiumDocBaseline ? premiumDocPageCount !== premiumDocBaseline.pageCount : false;
  const premiumSectionDiffs = premiumDocBaseline
    ? buildPremiumSectionDiffs(premiumDocSections, premiumDocBaseline.sections)
    : [];
  const premiumAssetDiffs = premiumDocBaseline
    ? editablePremiumAssets
        .map((asset) => {
          const baselineDraft = premiumDocBaseline.assetDrafts[asset.id] ?? { title: "", description: "" };
          const currentDraft = premiumAssetDrafts[asset.id] ?? { title: "", description: "" };
          const changes: string[] = [];
          if (normalizeDiffText(currentDraft.title) !== normalizeDiffText(baselineDraft.title)) changes.push("제목");
          if (normalizeDiffText(currentDraft.description) !== normalizeDiffText(baselineDraft.description)) changes.push("설명");
          if (changes.length === 0) return null;
          const meta = getPremiumAssetMeta(asset.meta_json);
          const resolved = resolvePremiumAssetPreviewText(asset.asset_type, meta, currentDraft);
          return {
            id: asset.id,
            title: resolved.title,
            detail: changes.join(", "),
          };
        })
        .filter((item): item is { id: string; title: string; detail: string } => item != null)
    : [];
  const premiumCompareTitleChanged = selectedCompareDocument
    ? normalizeDiffText(premiumDocTitle) !== normalizeDiffText(selectedCompareDocument.title)
    : false;
  const premiumCompareSummaryChanged = selectedCompareDocument
    ? normalizeDiffText(premiumDocSummary) !== normalizeDiffText(selectedCompareDocument.summary_text ?? "")
    : false;
  const premiumComparePageCountChanged = selectedCompareDocument
    ? premiumDocPageCount !== selectedCompareDocument.page_count
    : false;
  const premiumCompareSectionDiffs = selectedCompareDocument
    ? buildPremiumSectionDiffs(premiumDocSections, selectedCompareDocument.sections_json ?? [])
    : [];
  const hasCompareDocumentChanges =
    premiumCompareTitleChanged ||
    premiumCompareSummaryChanged ||
    premiumComparePageCountChanged ||
    premiumCompareSectionDiffs.length > 0;
  const hasUnsavedDocumentChanges =
    premiumDocTitleChanged || premiumDocSummaryChanged || premiumDocPageCountChanged || premiumSectionDiffs.length > 0;
  const hasUnsavedAssetDraftChanges = premiumAssetDiffs.length > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 pb-8">
      <div
        className={`mx-auto ${tab === "image_audit" || tab === "premium_reports" || tab === "premium_eligibility" ? "max-w-4xl" : "max-w-2xl"}`}
      >
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-lg font-bold">관리자</h1>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-slate-500 hover:text-slate-300"
          >
            로그아웃
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => setTab("records")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${tab === "records" ? "bg-electric-blue/80 text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600"}`}
          >
            기록 DB (awakenings)
          </button>
          <button
            type="button"
            onClick={() => setTab("members")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${tab === "members" ? "bg-electric-blue/80 text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600"}`}
          >
            회원 로그 정보 (participant_keys)
          </button>
          <button
            type="button"
            onClick={() => setTab("profiles")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${tab === "profiles" ? "bg-electric-blue/80 text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600"}`}
          >
            프로필 (participant_profiles)
          </button>
          <button
            type="button"
            onClick={() => setTab("ai_content")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${tab === "ai_content" ? "bg-electric-blue/80 text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600"}`}
          >
            AI 콘텐츠 (ai_generated_content)
          </button>
          <button
            type="button"
            onClick={() => setTab("moderation_quarantine")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${tab === "moderation_quarantine" ? "bg-electric-blue/80 text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600"}`}
          >
            삭제 보관함 (폐기)
          </button>
          <button
            type="button"
            onClick={() => setTab("entitlements")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${tab === "entitlements" ? "bg-electric-blue/80 text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600"}`}
          >
            기능 승인(유료) 토글
          </button>
          <button
            type="button"
            onClick={() => setTab("image_audit")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${tab === "image_audit" ? "bg-electric-blue/80 text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600"}`}
          >
            이미지·승인 로그
          </button>
          <button
            type="button"
            onClick={() => setTab("premium_reports")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${tab === "premium_reports" ? "bg-electric-blue/80 text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600"}`}
          >
            유료 보고서
          </button>
          <button
            type="button"
            onClick={() => setTab("premium_eligibility")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${tab === "premium_eligibility" ? "bg-electric-blue/80 text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600"}`}
          >
            유료 자격·인증
          </button>
        </div>
        {tab === "moderation_quarantine" && (
          <>
            <p className="text-xs text-slate-500 mb-2">
              AI·운영상 삭제 처리된 글(moderation_state = deleted). 기본적으로 삭제 시각 기준{" "}
              <span className="text-slate-300 font-medium">{quarantineDays}일</span>이 지나면 폐기 대상입니다.
              {purgeCutoffIso && (
                <span className="block mt-1 text-slate-600">
                  (현재 폐기 기준: 삭제 시각이{" "}
                  {new Date(purgeCutoffIso).toLocaleString("ko-KR")} 이전인 건 중 유보가 아닌 것)
                </span>
              )}
              「삭제 유보」는 purge_hold 로 일괄 폐기에서 제외됩니다. 환경변수 MODERATION_QUARANTINE_DAYS 로 7·30·90일 등 조정 가능.
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                type="button"
                disabled={purgeBusy || mqLoading}
                onClick={loadModerationArchive}
                className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 disabled:opacity-50"
              >
                새로고침
              </button>
              <button
                type="button"
                disabled={purgeBusy || mqLoading}
                onClick={handlePurgeModerationArchive}
                className="px-3 py-2 rounded-lg bg-red-900/50 text-red-200 text-sm hover:bg-red-900/70 disabled:opacity-50"
              >
                {purgeBusy ? "폐기 중..." : `폐기 대상 일괄 삭제 (${moderationArchived.filter((r) => r.purgeEligible).length}건)`}
              </button>
            </div>
          </>
        )}
        {tab === "records" && (
          <>
            <p className="text-xs text-slate-500 mb-2">
              사회적·공공선상 미풍양속, 정치·종교·사상·욕설·비방·협박 등 문제가 있는 경우에만 삭제 또는 수정하세요. 모든 조치는 admin_actions 테이블에 기록됩니다.
            </p>
            <div className="mb-4 space-y-3">
              <button
                type="button"
                onClick={handleBackupDownload}
                disabled={backupLoading}
                className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 disabled:opacity-50"
              >
                {backupLoading ? "백업 준비 중..." : "백업 다운로드 (원자료 + 반응 + 키워드 요약)"}
              </button>
              <AdminExportForm />
            </div>
          </>
        )}
        {tab === "members" && (
          <p className="text-xs text-slate-500 mb-4">
            내 기록 보기용으로 등록된 닉네임·비밀번호 힌트만 표시됩니다. 비밀번호 해시는 보안상 노출하지 않으며, 힌트만 수정할 수 있습니다.
          </p>
        )}
        {tab === "entitlements" && (
          <>
            <p className="text-xs text-slate-500 mb-3">
              사용자가 앱에서 보낸 유료 이미지 승인 요청을 확인·결제 확인·승인합니다. 수동 토글도 그대로 사용할 수 있습니다.
            </p>

            <div className="mb-4 p-3 rounded-lg bg-slate-800/60 border border-violet-500/30 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-medium text-slate-200">승인 요청 목록</h4>
                <select
                  value={imgReqFilter}
                  onChange={(e) => setImgReqFilter(e.target.value as "pending" | "all")}
                  className="text-xs rounded bg-slate-900 border border-slate-600 text-slate-200 px-2 py-1"
                >
                  <option value="pending">대기 중만</option>
                  <option value="all">전체</option>
                </select>
                <button
                  type="button"
                  onClick={() => void loadImageEntitlementRequests()}
                  disabled={imgReqLoading}
                  className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50"
                >
                  {imgReqLoading ? "새로고침…" : "새로고침"}
                </button>
              </div>
              {imgReqError && <p className="text-xs text-red-400 whitespace-pre-wrap">{imgReqError}</p>}
              {imgReqLoading && imgReqItems.length === 0 ? (
                <p className="text-xs text-slate-500">불러오는 중…</p>
              ) : imgReqItems.length === 0 ? (
                <p className="text-xs text-slate-500">표시할 요청이 없습니다.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] text-slate-300 border-collapse">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-700">
                        <th className="py-2 pr-2">닉네임</th>
                        <th className="py-2 pr-2">기능</th>
                        <th className="py-2 pr-2">요청 일시</th>
                        <th className="py-2 pr-2">결제</th>
                        <th className="py-2 pr-2">상태</th>
                        <th className="py-2">처리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {imgReqItems.map((row) => {
                        const busy = imgReqActionId === row.id;
                        const featureLabel =
                          row.feature_key === "image_cut" ? "한 장 컷" : "4면 웹툰";
                        const payLabel =
                          row.payment_status === "paid"
                            ? "결제완료"
                            : row.payment_status === "waived"
                              ? "면제"
                              : "미결제";
                        return (
                          <tr key={row.id} className="border-b border-slate-800/80 align-top">
                            <td className="py-2 pr-2 font-mono text-slate-200">
                              <button
                                type="button"
                                onClick={() => setEntNick(row.nickname)}
                                className="hover:text-electric-blue underline-offset-2 hover:underline"
                                title="아래 수동 승인란에 닉네임 채우기"
                              >
                                {row.nickname}
                              </button>
                            </td>
                            <td className="py-2 pr-2">{featureLabel}</td>
                            <td className="py-2 pr-2 whitespace-nowrap">
                              {new Date(row.requested_at).toLocaleString("ko-KR")}
                            </td>
                            <td className="py-2 pr-2">
                              <span
                                className={
                                  row.payment_status === "unpaid"
                                    ? "text-amber-300"
                                    : "text-emerald-300"
                                }
                              >
                                {payLabel}
                              </span>
                            </td>
                            <td className="py-2 pr-2">{row.status}</td>
                            <td className="py-2">
                              {row.status === "pending" ? (
                                <div className="flex flex-wrap gap-1">
                                  {row.payment_status === "unpaid" && (
                                    <>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => void patchImageEntitlementRequest(row.id, "mark_paid")}
                                        className="px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-200 border border-emerald-700/40 disabled:opacity-50"
                                      >
                                        결제 확인
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => void patchImageEntitlementRequest(row.id, "waive_payment")}
                                        className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 border border-slate-600 disabled:opacity-50"
                                      >
                                        면제
                                      </button>
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    disabled={busy || row.payment_status === "unpaid"}
                                    onClick={() => void patchImageEntitlementRequest(row.id, "approve")}
                                    className="px-1.5 py-0.5 rounded bg-electric-blue/25 text-electric-blue border border-electric-blue/40 disabled:opacity-50"
                                  >
                                    승인
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void patchImageEntitlementRequest(row.id, "reject")}
                                    className="px-1.5 py-0.5 rounded bg-red-900/30 text-red-200 border border-red-800/40 disabled:opacity-50"
                                  >
                                    거절
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-[10px] text-slate-600">
                승인 순서: 결제 확인(또는 면제) → 승인. 승인 시 participant_entitlements에 자동 반영됩니다.
              </p>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              서버 이미지/웹툰 생성 기능은 비용이 발생하므로, 닉네임별로 관리자 승인(토글)로만 활성화합니다. 무료 사용자는 로컬 생성만 가능합니다.
            </p>
            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 space-y-2">
              <div className="flex flex-wrap gap-2 items-end">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-slate-400">닉네임</span>
                  <input
                    type="text"
                    value={entNick}
                    onChange={(e) => setEntNick(e.target.value)}
                    placeholder="예: leejee5"
                    className="rounded bg-slate-900 border border-slate-600 text-slate-200 text-sm px-3 py-2 w-48"
                    maxLength={30}
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-slate-400">만료일(선택)</span>
                  <input
                    type="date"
                    value={entExpiresDate}
                    onChange={(e) => setEntExpiresDate(e.target.value)}
                    className="rounded bg-slate-900 border border-slate-600 text-slate-200 text-sm px-3 py-2 w-44"
                  />
                </label>
                <button
                  type="button"
                  onClick={loadEntitlements}
                  disabled={entLoading}
                  className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 disabled:opacity-50"
                >
                  {entLoading ? "조회 중..." : "조회"}
                </button>
                {entError && <span className="text-xs text-red-400">{entError}</span>}
              </div>

              {entNick.trim() && (
                <div className="pt-2 border-t border-slate-700/60 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-400">image_cut(한 장 컷)</span>
                    <button
                      type="button"
                      disabled={entLoading}
                      onClick={() => setEntitlement("image_cut", true)}
                      className="text-xs px-2 py-1 rounded bg-electric-blue/25 text-electric-blue border border-electric-blue/40 hover:bg-electric-blue/35 disabled:opacity-50"
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      disabled={entLoading}
                      onClick={() => setEntitlement("image_cut", false)}
                      className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600 disabled:opacity-50"
                    >
                      해제
                    </button>
                    <span className="text-[11px] text-slate-500">
                      현재:{" "}
                      {entRows.find((r) => r.feature_key === "image_cut")?.enabled ? (
                        <span className="text-emerald-300">ON</span>
                      ) : (
                        <span className="text-slate-500">OFF</span>
                      )}
                    </span>
                    {entRows.find((r) => r.feature_key === "image_cut")?.expires_at && (
                      <span className="text-[11px] text-slate-600">
                        만료:{" "}
                        {new Date(entRows.find((r) => r.feature_key === "image_cut")!.expires_at!).toLocaleString("ko-KR")}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-400">comic_4panel(4면 웹툰)</span>
                    <button
                      type="button"
                      disabled={entLoading}
                      onClick={() => setEntitlement("comic_4panel", true)}
                      className="text-xs px-2 py-1 rounded bg-deep-violet/20 text-slate-200 border border-deep-violet/40 hover:bg-deep-violet/30 disabled:opacity-50"
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      disabled={entLoading}
                      onClick={() => setEntitlement("comic_4panel", false)}
                      className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600 disabled:opacity-50"
                    >
                      해제
                    </button>
                    <span className="text-[11px] text-slate-500">
                      현재:{" "}
                      {entRows.find((r) => r.feature_key === "comic_4panel")?.enabled ? (
                        <span className="text-emerald-300">ON</span>
                      ) : (
                        <span className="text-slate-500">OFF</span>
                      )}
                    </span>
                    {entRows.find((r) => r.feature_key === "comic_4panel")?.expires_at && (
                      <span className="text-[11px] text-slate-600">
                        만료:{" "}
                        {new Date(entRows.find((r) => r.feature_key === "comic_4panel")!.expires_at!).toLocaleString("ko-KR")}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-600">
                    승인 후 사용자는 앱에서 “서버(유료·승인)” 모드를 선택해 생성할 수 있습니다.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
        {tab === "image_audit" && (
          <>
            <p className="text-xs text-slate-500 mb-3">
              기능 승인 변경 내역(admin_entitlement_actions), 서버 이미지 쿼터 집계용 사용 기록(image_generation_usage),
              저장된 생성 결과 메타(image_generation_assets)를 확인합니다. 닉네임을 비우면 전체(최근 50건)입니다.
            </p>
            <div className="flex flex-wrap gap-2 items-end mb-4">
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] text-slate-400">닉네임 필터(선택)</span>
                <input
                  type="text"
                  value={auditNick}
                  onChange={(e) => setAuditNick(e.target.value)}
                  placeholder="전체"
                  className="rounded bg-slate-900 border border-slate-600 text-slate-200 text-sm px-3 py-2 w-40"
                  maxLength={30}
                />
              </label>
              <button
                type="button"
                onClick={loadImageAudit}
                disabled={auditLoading}
                className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 disabled:opacity-50"
              >
                {auditLoading ? "불러오는 중..." : "새로고침"}
              </button>
              {auditError && <span className="text-xs text-red-400">{auditError}</span>}
            </div>

            <div className="space-y-6">
              <section>
                <h2 className="text-sm font-medium text-slate-400 mb-2">승인 변경 로그</h2>
                {auditLoading && entitlementActions.length === 0 ? (
                  <p className="text-slate-500 text-xs">불러오는 중...</p>
                ) : entitlementActions.length === 0 ? (
                  <p className="text-slate-600 text-xs">내역 없음</p>
                ) : (
                  <ul className="space-y-2 max-h-56 overflow-y-auto text-xs">
                    {entitlementActions.map((row) => (
                      <li
                        key={row.id}
                        className="p-2 rounded-lg bg-slate-800/60 border border-slate-700 flex flex-wrap gap-x-3 gap-y-1"
                      >
                        <time className="text-slate-500 shrink-0">
                          {new Date(row.created_at).toLocaleString("ko-KR")}
                        </time>
                        <span className="text-slate-300 font-medium">{row.nickname}</span>
                        <span className="text-slate-400">{row.feature_key}</span>
                        <span className={row.enabled ? "text-emerald-400" : "text-slate-500"}>
                          {row.enabled ? "ON" : "OFF"}
                        </span>
                        {row.expires_at && (
                          <span className="text-slate-600">
                            만료 {new Date(row.expires_at).toLocaleString("ko-KR")}
                          </span>
                        )}
                        <span className="text-slate-600">{row.source ?? "—"} / {row.enabled_by ?? "—"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h2 className="text-sm font-medium text-slate-400 mb-2">서버 생성 사용 기록(쿼터 집계)</h2>
                {auditLoading && imageUsageRows.length === 0 ? (
                  <p className="text-slate-500 text-xs">불러오는 중...</p>
                ) : imageUsageRows.length === 0 ? (
                  <p className="text-slate-600 text-xs">내역 없음</p>
                ) : (
                  <ul className="space-y-1 max-h-48 overflow-y-auto text-xs">
                    {imageUsageRows.map((row) => (
                      <li
                        key={row.id}
                        className="py-1 px-2 rounded bg-slate-800/40 border border-slate-700/80 flex flex-wrap gap-2"
                      >
                        <time className="text-slate-500">{new Date(row.created_at).toLocaleString("ko-KR")}</time>
                        <span>{row.nickname}</span>
                        <span className="text-slate-500">{row.feature_key}</span>
                        <span className="text-slate-600">{row.mode}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h2 className="text-sm font-medium text-slate-400 mb-2">저장된 생성 결과(미리보기)</h2>
                {auditLoading && imageAssetRows.length === 0 ? (
                  <p className="text-slate-500 text-xs">불러오는 중...</p>
                ) : imageAssetRows.length === 0 ? (
                  <p className="text-slate-600 text-xs">내역 없음</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {imageAssetRows.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-lg border border-slate-700 bg-slate-900/50 overflow-hidden text-[11px]"
                      >
                        {row.preview_url ? (
                          <a href={row.preview_url} target="_blank" rel="noreferrer" className="block">
                            <img src={row.preview_url} alt="" className="w-full h-28 object-cover" />
                          </a>
                        ) : (
                          <div className="h-28 flex items-center justify-center text-slate-600 bg-slate-800/50">
                            미리보기 URL 없음
                          </div>
                        )}
                        <div className="p-2 space-y-1">
                          <div className="text-slate-400">{new Date(row.created_at).toLocaleString("ko-KR")}</div>
                          <div className="font-medium text-slate-300">{row.nickname}</div>
                          <div className="text-slate-500">{row.feature_key} · {row.width ?? "?"}×{row.height ?? "?"}</div>
                          <p className="text-slate-500 line-clamp-3 break-words">{row.prompt_preview}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
        {tab === "records" && (loading ? (
          <p className="text-slate-500 py-8">목록 불러오는 중...</p>
        ) : (
          <ul className="space-y-3">
            {records.map((r) => (
              <li
                key={r.id}
                className="p-3 rounded-lg bg-slate-800/60 border border-slate-700"
              >
                <div className="flex justify-between items-start gap-2 text-xs text-slate-500">
                  <span>{r.nickname}</span>
                  <time>{new Date(r.created_at).toLocaleString("ko-KR")}</time>
                </div>
                {editingId === r.id ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-600 text-sm text-slate-100 resize-y min-h-[60px]"
                      maxLength={200}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        className="px-3 py-1 rounded bg-electric-blue/80 text-white text-sm"
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingId(null); setEditNote(""); }}
                        className="px-3 py-1 rounded bg-slate-600 text-sm"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-slate-300 break-words">{r.note}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        className="text-xs px-2 py-1 rounded bg-red-900/40 text-red-300 hover:bg-red-900/60"
                      >
                        삭제
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        ))}
        {tab === "records" && !loading && records.length === 0 && (
          <p className="text-slate-500 py-8 text-center">기록이 없습니다.</p>
        )}
        {tab === "members" && (
          <>
            {loading ? (
              <p className="text-slate-500 py-8">회원 목록 불러오는 중...</p>
            ) : (
              <ul className="space-y-3">
                {members.map((m) => (
                  <li
                    key={m.nickname}
                    className="p-3 rounded-lg bg-slate-800/60 border border-slate-700"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium text-slate-200">{m.nickname}</div>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {m.entitlements?.image_cut && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] bg-electric-blue/20 text-electric-blue border border-electric-blue/30">
                            image_cut ON
                          </span>
                        )}
                        {m.entitlements?.comic_4panel && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] bg-deep-violet/20 text-slate-200 border border-deep-violet/30">
                            comic_4panel ON
                          </span>
                        )}
                      </div>
                    </div>
                    {editingNickname === m.nickname ? (
                      <div className="mt-2 space-y-2">
                        <label className="text-xs text-slate-500">비밀번호 힌트</label>
                        <input
                          type="text"
                          value={editHint}
                          onChange={(e) => setEditHint(e.target.value)}
                          placeholder="힌트 (선택)"
                          className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-600 text-sm text-slate-100"
                          maxLength={100}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleSaveHint}
                            className="px-3 py-1 rounded bg-electric-blue/80 text-white text-sm"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingNickname(null); setEditHint(""); }}
                            className="px-3 py-1 rounded bg-slate-600 text-sm"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                          힌트: {m.password_hint ?? "(없음)"}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNickname(m.nickname);
                            setEditHint(m.password_hint ?? "");
                          }}
                          className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
                        >
                          힌트 수정
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {tab === "members" && !loading && members.length === 0 && (
              <p className="text-slate-500 py-8 text-center">등록된 회원이 없습니다.</p>
            )}
          </>
        )}
        {tab === "profiles" && (
          <>
            <p className="text-xs text-slate-500 mb-4">
              성별·연령대 등 프로필 (participant_profiles). 총 {profiles.length}명.
            </p>
            {profilesLoading ? (
              <p className="text-slate-500 py-8">불러오는 중...</p>
            ) : (
              <ul className="space-y-3">
                {profiles.map((p) => (
                  <li
                    key={p.nickname}
                    className="p-3 rounded-lg bg-slate-800/60 border border-slate-700"
                  >
                    <div className="text-sm font-medium text-slate-200">{p.nickname}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      성별: {p.gender ?? "—"} · 연령대: {p.age_group ?? "—"} · 수정: {new Date(p.updated_at).toLocaleString("ko-KR")}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {tab === "profiles" && !profilesLoading && profiles.length === 0 && (
              <p className="text-slate-500 py-8 text-center">프로필이 없습니다.</p>
            )}
          </>
        )}
        {tab === "moderation_quarantine" && (
          <>
            {mqLoading ? (
              <p className="text-slate-500 py-8">목록 불러오는 중...</p>
            ) : (
              <ul className="space-y-3">
                {moderationArchived.map((r) => (
                  <li
                    key={r.id}
                    className={`p-3 rounded-lg border ${
                      r.purgeEligible
                        ? "bg-amber-950/40 border-amber-800/60"
                        : "bg-slate-800/60 border-slate-700"
                    }`}
                  >
                    <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                      <span className="text-slate-300 font-medium">{r.nickname}</span>
                      {r.deleted_at && (
                        <time>{new Date(r.deleted_at).toLocaleString("ko-KR")} 삭제</time>
                      )}
                    </div>
                    {r.purgeEligible ? (
                      <p className="mt-1 text-[11px] text-amber-200">폐기 가능 (기간 충족·유보 아님)</p>
                    ) : r.purge_hold ? (
                      <p className="mt-1 text-[11px] text-slate-500">삭제 유보 중 — 일괄 폐기 제외</p>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-500">보관 기간 미충족</p>
                    )}
                    <p className="mt-1 text-sm text-slate-300 break-words">{r.note}</p>
                    {(r.moderation_reason ?? "").trim() !== "" && (
                      <p className="mt-1 text-[11px] text-slate-400 break-words">
                        사유: {r.moderation_reason}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleTogglePurgeHold(r.id, !r.purge_hold)
                        }
                        className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
                      >
                        {r.purge_hold ? "유보 해제" : "삭제 유보"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {!mqLoading && moderationArchived.length === 0 && (
              <p className="text-slate-500 py-8 text-center">삭제 보관 중인 글이 없습니다.</p>
            )}
          </>
        )}
        {tab === "premium_eligibility" && (
          <>
            <p className="text-xs text-slate-500 mb-3">
              유료 신청 목록(신청일시 최신순)에서 닉네임을 선택하거나 직접 입력해 자격·인증을 확인합니다. 기본: 매주 3일×4주 ·
              테스트: 최근 28일 12회 이상.
            </p>
            <div className="flex flex-wrap gap-2 items-center mb-3">
              <button
                type="button"
                onClick={loadPremiumEligibilityList}
                disabled={eligListLoading}
                className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 disabled:opacity-50"
              >
                {eligListLoading ? "목록 불러오는 중..." : "신청 목록 새로고침"}
              </button>
              {eligCheckError && <span className="text-xs text-red-400">{eligCheckError}</span>}
            </div>
            <div className="grid lg:grid-cols-[minmax(220px,280px)_1fr] gap-4 mb-4">
              <div className="rounded-lg border border-slate-700 bg-slate-900/50 max-h-[420px] overflow-y-auto">
                <p className="sticky top-0 z-10 bg-slate-900/95 px-3 py-2 text-[11px] text-slate-400 border-b border-slate-700">
                  신청 목록 · 신청일시 순
                </p>
                {eligListLoading && eligRequestList.length === 0 ? (
                  <p className="p-3 text-xs text-slate-500">불러오는 중...</p>
                ) : eligRequestList.length === 0 ? (
                  <p className="p-3 text-xs text-slate-500">유료 신청 내역이 없습니다.</p>
                ) : (
                  <ul className="divide-y divide-slate-800">
                    {eligRequestList.map((item) => (
                      <li key={item.requestId}>
                        <button
                          type="button"
                          onClick={() => selectEligibilityListItem(item)}
                          className={`w-full text-left px-3 py-2.5 hover:bg-slate-800/80 transition ${
                            selectedEligRequestId === item.requestId ? "bg-electric-blue/15" : ""
                          }`}
                        >
                          <p className="text-sm font-medium text-slate-200">{item.nickname}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {new Date(item.requested_at).toLocaleString("ko-KR")}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {item.status} · {item.payment_status}
                            {item.qualifies === true ? " · 자격 충족" : item.qualifies === false ? " · 자격 미충족" : ""}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 items-end">
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-slate-400">조회할 닉네임</span>
                    <input
                      type="text"
                      value={eligCheckNick}
                      onChange={(e) => setEligCheckNick(e.target.value)}
                      placeholder="닉네임 입력"
                      className="rounded-lg bg-slate-900 border border-slate-600 text-slate-200 text-sm px-3 py-2 w-48"
                      maxLength={20}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void loadPremiumEligibilityCheck()}
                    disabled={eligCheckLoading}
                    className="px-3 py-2 rounded-lg bg-electric-blue/80 text-white text-sm font-medium hover:bg-electric-blue disabled:opacity-50"
                  >
                    {eligCheckLoading ? "조회 중..." : "자격·인증 확인"}
                  </button>
                </div>
            {eligCheckResult && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg border border-slate-700 bg-slate-800/60 space-y-2">
                  <p className="text-sm text-slate-200 font-medium">
                    {String(eligCheckResult.nickname ?? "")} —{" "}
                    {eligCheckResult.canApplyPremiumReport ? (
                      <span className="text-emerald-300">유료 신청 가능</span>
                    ) : (
                      <span className="text-amber-300">유료 신청 불가</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">{String(eligCheckResult.message ?? "")}</p>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full px-2 py-1 bg-slate-700 text-slate-300">
                      비밀번호 등록: {eligCheckResult.hasParticipantKey ? "있음" : "없음"}
                    </span>
                    <span className="rounded-full px-2 py-1 bg-slate-700 text-slate-300">
                      주별 4주: {eligCheckResult.qualifiesWeekly ? "충족" : "미충족"}
                    </span>
                    <span className="rounded-full px-2 py-1 bg-slate-700 text-slate-300">
                      28일 12회+: {eligCheckResult.qualifiesRolling ? "충족" : "미충족"}
                    </span>
                  </div>
                  {typeof eligCheckResult.passwordHint === "string" && eligCheckResult.passwordHint && (
                    <p className="text-[11px] text-slate-500">비밀번호 힌트: {eligCheckResult.passwordHint}</p>
                  )}
                </div>
                {eligCheckResult.weeklyDayCounts && eligCheckResult.weeklyDayCounts.length > 0 && (
                  <div className="p-3 rounded-lg border border-slate-700 bg-slate-800/40">
                    <p className="text-xs text-slate-400 mb-2">주별 기록 일수 (일요일 주 기준)</p>
                    <div className="flex flex-wrap gap-2">
                      {eligCheckResult.weeklyDayCounts.map((row) => (
                          <span
                            key={row.week}
                            className={`text-[11px] rounded-full px-2 py-1 ${
                              row.qualifies ? "bg-deep-violet/30 text-slate-200" : "bg-slate-700 text-slate-400"
                            }`}
                          >
                            {row.week} · {row.distinctDays}일
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}
                {eligCheckResult.rolling && (
                  <div className="p-3 rounded-lg border border-slate-700 bg-slate-800/40">
                    <p className="text-xs text-slate-400 mb-1">28일 완화·테스트 기준</p>
                    <p className="text-xs text-slate-300">
                      기록 {eligCheckResult.rolling.recordCount}회 / 필요 {eligCheckResult.rolling.minRecords}회 (
                      {eligCheckResult.rolling.windowDays}일)
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {eligCheckResult.criteria?.rollingTest ?? ""}
                    </p>
                  </div>
                )}
                {eligCheckResult.recentRequests && eligCheckResult.recentRequests.length > 0 && (
                  <div className="p-3 rounded-lg border border-slate-700 bg-slate-800/40">
                    <p className="text-xs text-slate-400 mb-2">최근 유료 신청·결재</p>
                    <ul className="space-y-1 text-xs text-slate-300">
                      {eligCheckResult.recentRequests.map((r, i) => (
                          <li key={i}>
                            신청 {r.status} · 결재 {r.payment_status} ·{" "}
                            {new Date(r.updated_at).toLocaleString("ko-KR")}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
              </div>
            </div>
          </>
        )}
        {tab === "premium_reports" && (
          <>
            <p className="text-xs text-slate-500 mb-3">
              유료 감응 보고서 상품 기본값, 신청 상태, 최신 문서 초안을 함께 관리합니다. 저장된 문서가 있으면 사용자 다운로드 시 PDF로 즉시 생성됩니다.
            </p>
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={loadPremiumReports}
                disabled={premiumLoading}
                className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 disabled:opacity-50"
              >
                {premiumLoading ? "불러오는 중..." : "새로고침"}
              </button>
              {premiumError && <span className="text-xs text-red-400">{premiumError}</span>}
            </div>

            <div className="space-y-6">
              <section>
                <h2 className="text-sm font-medium text-slate-400 mb-2">상품/기본 분량 설정</h2>
                {premiumProducts.length === 0 ? (
                  <p className="text-slate-500 text-xs">등록된 상품이 없습니다.</p>
                ) : (
                  <ul className="space-y-3">
                    {premiumProducts.map((row) => (
                      <li key={row.id} className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm text-slate-200 font-medium">{row.name}</p>
                            <p className="text-[11px] text-slate-500">{row.code}</p>
                          </div>
                          <span className={`text-xs ${row.active ? "text-emerald-300" : "text-slate-500"}`}>
                            {row.active ? "활성" : "비활성"}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="text-xs text-slate-400">기본 페이지 수: {row.default_pages}</span>
                          <button
                            type="button"
                            onClick={() => savePremiumProduct(row, { default_pages: Math.max(1, row.default_pages - 1) })}
                            className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
                          >
                            -1p
                          </button>
                          <button
                            type="button"
                            onClick={() => savePremiumProduct(row, { default_pages: row.default_pages + 1 })}
                            className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
                          >
                            +1p
                          </button>
                          <button
                            type="button"
                            onClick={() => savePremiumProduct(row, { active: !row.active })}
                            className="text-xs px-2 py-1 rounded bg-deep-violet/30 text-slate-200 hover:bg-deep-violet/40"
                          >
                            {row.active ? "비활성화" : "활성화"}
                          </button>
                        </div>
                        {row.description && <p className="text-xs text-slate-500">{row.description}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h2 className="text-sm font-medium text-slate-400 mb-2">신청 목록</h2>
                {premiumProducts.length === 0 && premiumRequests.length === 0 && premiumLoading ? (
                  <p className="text-slate-500 text-xs">불러오는 중...</p>
                ) : premiumRequests.length === 0 ? (
                  <p className="text-slate-500 text-xs">신청 내역이 없습니다.</p>
                ) : (
                  <ul className="space-y-3">
                    {premiumRequests.map((row) => {
                      const isSelectedRequest = selectedPremiumRequestId === row.id;
                      const hasPublishedPdfForSelected =
                        isSelectedRequest &&
                        premiumDocPdfStatus === "ready" &&
                        premiumDocAssets.some((item) => item.asset_type === "final_pdf");
                      const canConfirmPayment = canConfirmPremiumPayment(row.status, row.payment_status);
                      const canApprove = canApprovePremiumRequest(row.status, row.payment_status);
                      const canStart = canStartPremiumRequest(row.status);
                      const canRelease =
                        canReleasePremiumRequest(row.status, row.payment_status) &&
                        (!isSelectedRequest || hasPublishedPdfForSelected);
                      const canReject = canRejectPremiumRequest(row.status);

                      return (
                        <li key={row.id} className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                            <span className="text-slate-300 font-medium">{row.nickname}</span>
                            <span>상태 {row.status}</span>
                            <span>결재 {row.payment_status}</span>
                            <time>{new Date(row.requested_at).toLocaleString("ko-KR")}</time>
                          </div>
                          {row.admin_note && <p className="text-xs text-slate-500">메모: {row.admin_note}</p>}
                          <p className="text-[11px] text-slate-600">
                            작성 시작은 승인 후에만 가능하고, 다운로드 허용은 결제 확인 + 최종 PDF 발행 후에만 가능합니다.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => loadPremiumDocument(row.id)}
                              className="text-xs px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
                            >
                              문서 편집
                            </button>
                            <button
                              type="button"
                              disabled={premiumLoading || !canConfirmPayment}
                              onClick={() =>
                                updatePremiumRequestStatus(row.id, {
                                  paymentStatus: "confirmed",
                                  adminNote: "입금/결재 확인 완료",
                                })
                              }
                              className="text-xs px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 disabled:opacity-40"
                              title={canConfirmPayment ? "" : "신청 접수 단계에서만 결재 확인을 처리할 수 있습니다."}
                            >
                              결재 확인
                            </button>
                            <button
                              type="button"
                              disabled={premiumLoading || !canApprove}
                              onClick={() =>
                                updatePremiumRequestStatus(row.id, {
                                  status: "approved",
                                  paymentStatus: row.payment_status,
                                  adminNote: "승인 완료",
                                })
                              }
                              className="text-xs px-2 py-1 rounded bg-electric-blue/25 text-electric-blue border border-electric-blue/40 hover:bg-electric-blue/35 disabled:opacity-40"
                              title={canApprove ? "" : "결제 확인 완료 상태에서만 승인할 수 있습니다."}
                            >
                              승인
                            </button>
                            <button
                              type="button"
                              disabled={premiumLoading || !canStart}
                              onClick={() =>
                                updatePremiumRequestStatus(row.id, {
                                  status: "in_progress",
                                  paymentStatus: row.payment_status,
                                  adminNote: "보고서 작성 시작",
                                })
                              }
                              className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40"
                              title={canStart ? "" : "승인 완료 후에만 작성 시작할 수 있습니다."}
                            >
                              작성 시작
                            </button>
                            <button
                              type="button"
                              disabled={premiumLoading || !canRelease}
                              onClick={() =>
                                updatePremiumRequestStatus(row.id, {
                                  status: "ready",
                                  paymentStatus: row.payment_status,
                                  downloadable: true,
                                  adminNote: "최종본 배포 허용",
                                })
                              }
                              className="text-xs px-2 py-1 rounded bg-deep-violet/30 text-slate-200 hover:bg-deep-violet/40 disabled:opacity-40"
                              title={
                                canRelease
                                  ? ""
                                  : "결제 확인과 최종 PDF 발행이 끝난 뒤에만 다운로드를 허용할 수 있습니다."
                              }
                            >
                              다운로드 허용
                            </button>
                            <button
                              type="button"
                              disabled={premiumLoading || !canReject}
                              onClick={() =>
                                updatePremiumRequestStatus(row.id, {
                                  status: "rejected",
                                  paymentStatus: row.payment_status,
                                  downloadable: false,
                                  adminNote: "관리자 반려",
                                })
                              }
                              className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-red-500/20 disabled:opacity-40"
                            >
                              반려
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section>
                <h2 className="text-sm font-medium text-slate-400 mb-2">문서 편집기</h2>
                {!selectedPremiumRequestId ? (
                  <p className="text-slate-500 text-xs">신청 목록에서 `문서 편집`을 눌러 초안을 불러오세요.</p>
                ) : premiumDocLoading ? (
                  <p className="text-slate-500 text-xs">문서 불러오는 중...</p>
                ) : (
                  <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-200">
                          {selectedPremiumRequest?.nickname ?? "선택된 신청"} 문서
                        </p>
                        <p className="text-[11px] text-slate-500">
                          request_id: {selectedPremiumRequestId} · 현재 버전 {premiumDocVersion} · PDF 상태 {premiumDocPdfStatus}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={savePremiumDocument}
                          disabled={premiumDocSaveBusy}
                          className="px-3 py-2 rounded-lg bg-electric-blue/25 text-electric-blue border border-electric-blue/40 hover:bg-electric-blue/35 disabled:opacity-50 text-sm"
                        >
                          {premiumDocSaveBusy ? "저장 중..." : "문서 저장"}
                        </button>
                        <button
                          type="button"
                          onClick={publishPremiumDocument}
                          disabled={premiumDocPublishBusy}
                          className="px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50 text-sm"
                        >
                          {premiumDocPublishBusy ? "발행 중..." : premiumDocAssets.some((item) => item.asset_type === "final_pdf") ? "최종 PDF 재발행" : "최종 PDF 발행"}
                        </button>
                      </div>
                    </div>

                    {premiumDocError && <p className="text-xs text-red-400">{premiumDocError}</p>}

                    <div className="rounded-xl border border-amber-500/20 bg-slate-950/70 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-amber-300">저장 전 변경 요약</p>
                          <p className="text-[11px] text-slate-500">현재 불러온 버전과 비교해 무엇이 달라졌는지 바로 확인합니다.</p>
                        </div>
                        <span
                          className={`rounded px-2 py-1 text-[10px] ${
                            hasUnsavedDocumentChanges || hasUnsavedAssetDraftChanges
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-emerald-500/15 text-emerald-300"
                          }`}
                        >
                          {hasUnsavedDocumentChanges || hasUnsavedAssetDraftChanges ? "미저장 변경 있음" : "변경 없음"}
                        </span>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-medium text-slate-300">문서 저장 대상</p>
                            <span className="text-[10px] text-slate-500">`문서 저장` 버튼으로 반영</span>
                          </div>
                          <div className="mt-2 space-y-2 text-[11px]">
                            {!hasUnsavedDocumentChanges ? (
                              <p className="text-slate-500">문서 제목, 요약, 페이지 수, 섹션 변경이 없습니다.</p>
                            ) : (
                              <>
                                {premiumDocTitleChanged && (
                                  <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2 text-slate-300">
                                    문서 제목 수정
                                  </div>
                                )}
                                {premiumDocSummaryChanged && (
                                  <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2 text-slate-300">
                                    핵심 요약 수정
                                  </div>
                                )}
                                {premiumDocPageCountChanged && (
                                  <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2 text-slate-300">
                                    페이지 수 변경: {premiumDocBaseline?.pageCount ?? 0}p → {premiumDocPageCount}p
                                  </div>
                                )}
                                {premiumSectionDiffs.map((item) => (
                                  <div
                                    key={item.key}
                                    className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2 text-slate-300"
                                  >
                                    <p>{item.label}</p>
                                    <p className="mt-1 text-slate-500">{item.detail}</p>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-medium text-slate-300">자산 설명 저장 대상</p>
                            <span className="text-[10px] text-slate-500">각 자산 카드의 `설명 저장`으로 반영</span>
                          </div>
                          <div className="mt-2 space-y-2 text-[11px]">
                            {!hasUnsavedAssetDraftChanges ? (
                              <p className="text-slate-500">자산 제목/설명 변경이 없습니다.</p>
                            ) : (
                              premiumAssetDiffs.map((item) => (
                                <div
                                  key={item.id}
                                  className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2 text-slate-300"
                                >
                                  <p className="break-words">{item.title}</p>
                                  <p className="mt-1 text-slate-500">{item.detail} 수정</p>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-cyan-500/20 bg-slate-950/70 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-cyan-300">저장 버전 비교</p>
                          <p className="text-[11px] text-slate-500">현재 초안을 이전 저장 버전과 비교해 어떤 방향으로 달라졌는지 확인합니다.</p>
                        </div>
                        {selectedCompareDocument && (
                          <span className="rounded bg-cyan-500/15 px-2 py-1 text-[10px] text-cyan-300">
                            비교 기준 v{selectedCompareDocument.version}
                          </span>
                        )}
                      </div>

                      {premiumDocHistory.length === 0 ? (
                        <p className="text-[11px] text-slate-500">아직 저장된 문서 버전이 없습니다.</p>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="flex items-center gap-2 text-[11px] text-slate-400">
                              <span>비교 버전</span>
                              <select
                                value={premiumCompareVersion ?? ""}
                                onChange={(e) => setPremiumCompareVersion(Number(e.target.value) || null)}
                                className="rounded bg-slate-900 border border-slate-700 text-slate-200 text-xs px-2 py-1.5"
                              >
                                {premiumDocHistory.map((doc) => (
                                  <option key={`compare-version-${doc.version}`} value={doc.version}>
                                    v{doc.version} {doc.created_at ? `· ${new Date(doc.created_at).toLocaleString("ko-KR")}` : ""}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              type="button"
                              onClick={restorePremiumCompareDocumentToDraft}
                              disabled={!selectedCompareDocument || premiumRestoreBusy || premiumDocSaveBusy}
                              className="px-2 py-1.5 rounded bg-cyan-500/15 text-cyan-300 text-xs hover:bg-cyan-500/25 disabled:opacity-40"
                            >
                              {premiumRestoreBusy ? "복원 준비 중..." : "이 버전을 초안으로 불러오기"}
                            </button>
                            <button
                              type="button"
                              onClick={backupAndRestorePremiumCompareDocumentToDraft}
                              disabled={!selectedCompareDocument || premiumRestoreBusy || premiumDocSaveBusy || !hasUnsavedDocumentChanges}
                              className="px-2 py-1.5 rounded bg-emerald-500/15 text-emerald-300 text-xs hover:bg-emerald-500/25 disabled:opacity-40"
                            >
                              {premiumRestoreBusy ? "백업 저장 중..." : "현재 초안 백업 후 불러오기"}
                            </button>
                          </div>

                          {selectedCompareDocument && (
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                                <p className="text-[11px] font-medium text-slate-300">현재 초안 기준 차이</p>
                                <div className="mt-2 space-y-2 text-[11px]">
                                  {!hasCompareDocumentChanges ? (
                                    <p className="text-slate-500">선택한 버전과 현재 초안이 같습니다.</p>
                                  ) : (
                                    <>
                                      {premiumCompareTitleChanged && (
                                        <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2 text-slate-300">
                                          문서 제목 수정
                                        </div>
                                      )}
                                      {premiumCompareSummaryChanged && (
                                        <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2 text-slate-300">
                                          핵심 요약 수정
                                        </div>
                                      )}
                                      {premiumComparePageCountChanged && (
                                        <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2 text-slate-300">
                                          페이지 수 변경: {selectedCompareDocument.page_count}p → {premiumDocPageCount}p
                                        </div>
                                      )}
                                      {premiumCompareSectionDiffs.map((item) => (
                                        <div
                                          key={`compare-${item.key}`}
                                          className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2 text-slate-300"
                                        >
                                          <p>{item.label}</p>
                                          <p className="mt-1 text-slate-500">{item.detail}</p>
                                        </div>
                                      ))}
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                                <p className="text-[11px] font-medium text-slate-300">선택 버전 정보</p>
                                <div className="mt-2 space-y-2 text-[11px] text-slate-400">
                                  <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2">
                                    <p className="text-slate-300">제목</p>
                                    <p className="mt-1 break-words">{selectedCompareDocument.title || "제목 없음"}</p>
                                  </div>
                                  <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2">
                                    <p className="text-slate-300">핵심 요약</p>
                                    <p className="mt-1 break-words">
                                      {compactPreviewText(selectedCompareDocument.summary_text ?? "", 220) || "요약 없음"}
                                    </p>
                                  </div>
                                  <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2">
                                    <p className="text-slate-300">
                                      페이지 {selectedCompareDocument.page_count}p · 섹션 {selectedCompareDocument.sections_json.length}개
                                    </p>
                                    <p className="mt-1 text-slate-500">
                                      {selectedCompareDocument.created_at
                                        ? new Date(selectedCompareDocument.created_at).toLocaleString("ko-KR")
                                        : "생성 시각 없음"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {selectedCompareDocument && (
                      <>
                        <div className="rounded-xl border border-sky-500/20 bg-slate-950/70 p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-sky-300">선택 버전 읽기 전용 미리보기</p>
                              <p className="text-[11px] text-slate-500">문서 내용은 선택한 저장 버전 기준이며, 자산 표시는 현재 연결된 자산 기준입니다.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded bg-sky-500/15 px-2 py-1 text-[10px] text-sky-300">
                                v{selectedCompareDocument.version} snapshot
                              </span>
                              <button
                                type="button"
                                onClick={restorePremiumCompareDocumentToDraft}
                                disabled={premiumRestoreBusy || premiumDocSaveBusy}
                                className="px-2 py-1 rounded bg-sky-500/15 text-sky-300 text-[11px] hover:bg-sky-500/25 disabled:opacity-40"
                              >
                                {premiumRestoreBusy ? "복원 준비 중..." : "이 버전으로 초안 채우기"}
                              </button>
                              <button
                                type="button"
                                onClick={backupAndRestorePremiumCompareDocumentToDraft}
                                disabled={premiumRestoreBusy || premiumDocSaveBusy || !hasUnsavedDocumentChanges}
                                className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 text-[11px] hover:bg-emerald-500/25 disabled:opacity-40"
                              >
                                {premiumRestoreBusy ? "백업 저장 중..." : "현재 초안 백업 후 채우기"}
                              </button>
                            </div>
                          </div>

                          <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-4 space-y-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[11px] text-slate-500">선택 저장 버전</p>
                                <h3 className="mt-1 text-lg font-semibold text-white break-words">
                                  {selectedCompareDocument.title.trim() || "제목 없음"}
                                </h3>
                                <p className="mt-1 text-[11px] text-slate-500">
                                  {selectedPremiumRequest?.nickname ?? "닉네임 없음"} · {selectedCompareDocument.page_count}p
                                  {selectedCompareDocument.created_at
                                    ? ` · ${new Date(selectedCompareDocument.created_at).toLocaleString("ko-KR")}`
                                    : ""}
                                </p>
                              </div>
                              <div className="rounded border border-slate-700 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-400">
                                섹션 {selectedCompareSections.length}개 · 이미지 {premiumPreviewImageCount}개 · 첨부 PDF {premiumPreviewAttachmentPdfCount}개
                              </div>
                            </div>

                            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                              <p className="text-[11px] text-slate-500">대표 시각 자료</p>
                              {premiumPreviewCoverAsset ? (
                                <div className="mt-2 flex gap-3">
                                  <div className="shrink-0">
                                    {premiumPreviewCoverAsset.download_url ? (
                                      <img
                                        src={premiumPreviewCoverAsset.download_url}
                                        alt={premiumPreviewCoverTitle}
                                        className="h-20 w-20 rounded object-cover border border-slate-700 bg-slate-900"
                                      />
                                    ) : (
                                      <div className="h-20 w-20 rounded border border-slate-700 bg-slate-900/70 flex items-center justify-center text-[10px] text-slate-500 text-center px-2">
                                        대표 이미지
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs text-slate-200 break-words">{premiumPreviewCoverTitle}</p>
                                    <p className="mt-1 text-[11px] text-slate-500">현재 연결 자산 기준 대표 시각 자료</p>
                                    <p className="mt-1 text-[11px] text-slate-400 break-words">
                                      {premiumPreviewCoverDescription || "설명 없음"}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <p className="mt-2 text-[11px] text-slate-500">대표 이미지가 아직 없습니다.</p>
                              )}
                            </div>

                            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                              <p className="text-[11px] text-slate-500">핵심 요약</p>
                              <p className="mt-2 text-sm leading-6 text-slate-200 break-words">
                                {compactPreviewText(selectedCompareDocument.summary_text ?? "", 260) || "핵심 요약이 없습니다."}
                              </p>
                            </div>

                            <div className="space-y-2">
                              <p className="text-[11px] text-slate-500">본문 섹션 흐름</p>
                              {selectedCompareSections.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/50 px-3 py-4 text-[11px] text-slate-500">
                                  이 버전에는 저장된 섹션이 없습니다.
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {selectedCompareSections.slice(0, 6).map((section, index) => (
                                    <div
                                      key={`${section.key}-${index}-history-preview`}
                                      className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
                                    >
                                      <p className="text-[10px] text-slate-500">섹션 {index + 1}</p>
                                      <p className="mt-1 text-sm font-medium text-slate-100 break-words">
                                        {section.title.trim() || `제목 없는 섹션 ${index + 1}`}
                                      </p>
                                      <p className="mt-1 text-[11px] leading-5 text-slate-400 break-words">
                                        {compactPreviewText(section.body, 220) || "본문 없음"}
                                      </p>
                                    </div>
                                  ))}
                                  {selectedCompareHiddenSectionCount > 0 && (
                                    <p className="text-[11px] text-slate-500">
                                      나머지 섹션 {selectedCompareHiddenSectionCount}개는 이 버전 문서에 이어서 포함됩니다.
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-violet-500/20 bg-slate-950/70 p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-violet-300">선택 버전 페이지형 시안</p>
                              <p className="text-[11px] text-slate-500">선택한 저장 버전의 문서 본문을 읽기 전용 페이지 블록으로 재구성한 상태입니다.</p>
                            </div>
                            <span className="rounded bg-violet-500/15 px-2 py-1 text-[10px] text-violet-300">
                              history layout
                            </span>
                          </div>

                          <div className="space-y-4">
                            <div className="rounded-[28px] border border-slate-700 bg-white text-slate-900 shadow-[0_12px_32px_rgba(0,0,0,0.35)] overflow-hidden">
                              <div className="border-b border-slate-200 px-6 py-3 text-[11px] text-slate-500">
                                Page 1 · History Cover
                              </div>
                              <div className="p-6 space-y-5">
                                <div>
                                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Saved Report Version</p>
                                  <h3 className="mt-2 text-2xl font-semibold break-words">
                                    {selectedCompareDocument.title.trim() || "제목 없음"}
                                  </h3>
                                  <p className="mt-2 text-sm text-slate-500">
                                    {selectedPremiumRequest?.nickname ?? "닉네임 없음"} · {selectedCompareDocument.page_count}p · v{selectedCompareDocument.version}
                                  </p>
                                </div>

                                <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
                                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 min-h-[280px] flex items-center justify-center">
                                    {premiumPreviewCoverAsset?.download_url ? (
                                      <img
                                        src={premiumPreviewCoverAsset.download_url}
                                        alt={premiumPreviewCoverTitle}
                                        className="max-h-[260px] w-full rounded-xl object-cover"
                                      />
                                    ) : (
                                      <div className="text-center text-sm text-slate-400">
                                        대표 이미지가 아직 없습니다.
                                      </div>
                                    )}
                                  </div>
                                  <div className="space-y-3">
                                    <div className="rounded-2xl border border-slate-200 p-4">
                                      <p className="text-xs text-slate-400">대표 시각 자료</p>
                                      <p className="mt-2 text-base font-medium break-words">
                                        {premiumPreviewCoverTitle || "대표 자료 제목 없음"}
                                      </p>
                                      <p className="mt-2 text-sm leading-6 text-slate-600 break-words">
                                        {compactPreviewText(premiumPreviewCoverDescription, 180) || "설명 없음"}
                                      </p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 p-4">
                                      <p className="text-xs text-slate-400">핵심 요약</p>
                                      <p className="mt-2 text-sm leading-6 text-slate-700 break-words">
                                        {compactPreviewText(selectedCompareDocument.summary_text ?? "", 220) || "핵심 요약이 없습니다."}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {selectedCompareSectionPages.length > 0 ? (
                              selectedCompareSectionPages.map((sectionPage, pageIndex) => (
                                <div
                                  key={`history-section-page-${pageIndex}`}
                                  className="rounded-[28px] border border-slate-700 bg-white text-slate-900 shadow-[0_12px_32px_rgba(0,0,0,0.35)] overflow-hidden"
                                >
                                  <div className="border-b border-slate-200 px-6 py-3 text-[11px] text-slate-500">
                                    Page {pageIndex + 2} · History Sections
                                  </div>
                                  <div className="p-6 space-y-5">
                                    {sectionPage.map((section, sectionIndex) => (
                                      <div key={`${section.key}-${pageIndex}-${sectionIndex}-history`} className="space-y-2">
                                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                          Section {pageIndex * 2 + sectionIndex + 1}
                                        </p>
                                        <h4 className="text-lg font-semibold break-words">
                                          {section.title.trim() || `제목 없는 섹션 ${pageIndex * 2 + sectionIndex + 1}`}
                                        </h4>
                                        <p className="text-sm leading-7 text-slate-700 whitespace-pre-wrap break-words">
                                          {compactPreviewText(section.body, 900) || "본문 없음"}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-[28px] border border-slate-700 bg-white text-slate-400 shadow-[0_12px_32px_rgba(0,0,0,0.35)] overflow-hidden">
                                <div className="border-b border-slate-200 px-6 py-3 text-[11px]">Page 2 · History Sections</div>
                                <div className="p-6 text-sm">
                                  이 저장 버전에는 본문 섹션이 없습니다.
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    <div className="grid md:grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] text-slate-400">문서 제목</span>
                        <input
                          type="text"
                          value={premiumDocTitle}
                          onChange={(e) => setPremiumDocTitle(e.target.value)}
                          className="rounded bg-slate-900 border border-slate-600 text-slate-200 text-sm px-3 py-2"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] text-slate-400">설정 페이지 수</span>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={premiumDocPageCount}
                          onChange={(e) => setPremiumDocPageCount(Number(e.target.value) || 1)}
                          className="rounded bg-slate-900 border border-slate-600 text-slate-200 text-sm px-3 py-2"
                        />
                      </label>
                    </div>

                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-slate-400">핵심 요약</span>
                      <textarea
                        value={premiumDocSummary}
                        onChange={(e) => setPremiumDocSummary(e.target.value)}
                        rows={4}
                        className="rounded bg-slate-900 border border-slate-600 text-slate-200 text-sm px-3 py-2"
                      />
                    </label>

                    <div className="rounded-xl border border-electric-blue/20 bg-slate-950/70 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-electric-blue">PDF 문서 미리보기</p>
                          <p className="text-[11px] text-slate-500">현재 편집 중인 값이 바로 반영된 초안 흐름입니다.</p>
                        </div>
                        <span className="rounded bg-electric-blue/15 px-2 py-1 text-[10px] text-electric-blue">
                          라이브 프리뷰
                        </span>
                      </div>

                      <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-4 space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] text-slate-500">표지 / 첫 장</p>
                            <h3 className="mt-1 text-lg font-semibold text-white break-words">
                              {premiumDocTitle.trim() || "제목 없음"}
                            </h3>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {selectedPremiumRequest?.nickname ?? "닉네임 없음"} · {premiumDocPageCount}p · PDF 상태 {premiumDocPdfStatus}
                            </p>
                          </div>
                          <div className="rounded border border-slate-700 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-400">
                            섹션 {premiumPreviewSections.length}개 · 이미지 {premiumPreviewImageCount}개 · 첨부 PDF {premiumPreviewAttachmentPdfCount}개
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                          <p className="text-[11px] text-slate-500">대표 시각 자료</p>
                          {premiumPreviewCoverAsset ? (
                            <div className="mt-2 flex gap-3">
                              <div className="shrink-0">
                                {premiumPreviewCoverAsset.download_url ? (
                                  <img
                                    src={premiumPreviewCoverAsset.download_url}
                                    alt={premiumPreviewCoverTitle}
                                    className="h-20 w-20 rounded object-cover border border-slate-700 bg-slate-900"
                                  />
                                ) : (
                                  <div className="h-20 w-20 rounded border border-slate-700 bg-slate-900/70 flex items-center justify-center text-[10px] text-slate-500 text-center px-2">
                                    대표 이미지
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-slate-200 break-words">{premiumPreviewCoverTitle}</p>
                                <p className="mt-1 text-[11px] text-slate-500">PDF 첫 장의 대표 시각 자료로 반영</p>
                                <p className="mt-1 text-[11px] text-slate-400 break-words">
                                  {premiumPreviewCoverDescription || "설명 없음"}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2 space-y-2">
                              <p className="text-[11px] text-slate-500">대표 이미지가 아직 없습니다. PNG/JPG/WEBP로 등록하면 PDF 첫 장에 반영됩니다.</p>
                              <label className="inline-flex items-center gap-2">
                                <input
                                  key={premiumCoverInputKey}
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp"
                                  disabled={premiumAssetBusy || !selectedPremiumRequestId}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) void uploadPremiumCoverImage(file);
                                  }}
                                  className="text-[11px] text-slate-400 file:mr-2 file:rounded file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-slate-200"
                                />
                              </label>
                            </div>
                          )}
                          {premiumPreviewCoverAsset && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] px-2 py-1 rounded bg-slate-700 text-slate-200 hover:bg-slate-600">
                                이미지 교체
                                <input
                                  key={`replace-${premiumCoverInputKey}`}
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp"
                                  className="hidden"
                                  disabled={premiumAssetBusy}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) void uploadPremiumCoverImage(file, premiumPreviewCoverAsset.id);
                                  }}
                                />
                              </label>
                              <button
                                type="button"
                                disabled={premiumAssetActionBusyId === premiumPreviewCoverAsset.id}
                                onClick={() => deletePremiumAsset(premiumPreviewCoverAsset.id)}
                                className="text-[11px] px-2 py-1 rounded bg-red-500/15 text-red-300 hover:bg-red-500/25 disabled:opacity-50"
                              >
                                대표 이미지 삭제
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                          <p className="text-[11px] text-slate-500">핵심 요약</p>
                          <p className="mt-2 text-sm leading-6 text-slate-200 break-words">
                            {compactPreviewText(premiumDocSummary, 260) || "핵심 요약이 아직 없습니다."}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[11px] text-slate-500">본문 섹션 흐름</p>
                          {premiumPreviewSections.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/50 px-3 py-4 text-[11px] text-slate-500">
                              섹션을 추가하면 PDF 본문 흐름이 여기에서 바로 보입니다.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {premiumPreviewSections.slice(0, 6).map((section, index) => (
                                <div key={`${section.key}-${index}-preview`} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                                  <p className="text-[10px] text-slate-500">섹션 {index + 1}</p>
                                  <p className="mt-1 text-sm font-medium text-slate-100 break-words">
                                    {section.title.trim() || `제목 없는 섹션 ${index + 1}`}
                                  </p>
                                  <p className="mt-1 text-[11px] leading-5 text-slate-400 break-words">
                                    {compactPreviewText(section.body, 220) || "본문 없음"}
                                  </p>
                                </div>
                              ))}
                              {premiumPreviewHiddenSectionCount > 0 && (
                                <p className="text-[11px] text-slate-500">
                                  나머지 섹션 {premiumPreviewHiddenSectionCount}개는 저장/발행 시 이어서 반영됩니다.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-fuchsia-500/20 bg-slate-950/70 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-fuchsia-300">HTML 기반 PDF 시안 보기</p>
                          <p className="text-[11px] text-slate-500">실제 PDF 순서를 따라가도록 화면용 시안 블록으로 펼쳐 본 상태입니다.</p>
                        </div>
                        <span className="rounded bg-fuchsia-500/15 px-2 py-1 text-[10px] text-fuchsia-300">
                          페이지형 시안
                        </span>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-[28px] border border-slate-700 bg-white text-slate-900 shadow-[0_12px_32px_rgba(0,0,0,0.35)] overflow-hidden">
                          <div className="border-b border-slate-200 px-6 py-3 text-[11px] text-slate-500">
                            Page 1 · Cover
                          </div>
                          <div className="p-6 space-y-5">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">My Awakened Resonance Report</p>
                              <h3 className="mt-2 text-2xl font-semibold break-words">
                                {premiumDocTitle.trim() || "제목 없음"}
                              </h3>
                              <p className="mt-2 text-sm text-slate-500">
                                {selectedPremiumRequest?.nickname ?? "닉네임 없음"} · {premiumDocPageCount}p
                              </p>
                            </div>

                            <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 min-h-[280px] flex items-center justify-center">
                                {premiumPreviewCoverAsset?.download_url ? (
                                  <img
                                    src={premiumPreviewCoverAsset.download_url}
                                    alt={premiumPreviewCoverTitle}
                                    className="max-h-[260px] w-full rounded-xl object-cover"
                                  />
                                ) : (
                                  <div className="text-center text-sm text-slate-400">
                                    대표 이미지가 아직 없습니다.
                                  </div>
                                )}
                              </div>
                              <div className="space-y-3">
                                <div className="rounded-2xl border border-slate-200 p-4">
                                  <p className="text-xs text-slate-400">대표 시각 자료</p>
                                  <p className="mt-2 text-base font-medium break-words">
                                    {premiumPreviewCoverTitle || "대표 자료 제목 없음"}
                                  </p>
                                  <p className="mt-2 text-sm leading-6 text-slate-600 break-words">
                                    {compactPreviewText(premiumPreviewCoverDescription, 180) || "설명 없음"}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 p-4">
                                  <p className="text-xs text-slate-400">핵심 요약</p>
                                  <p className="mt-2 text-sm leading-6 text-slate-700 break-words">
                                    {compactPreviewText(premiumDocSummary, 220) || "핵심 요약이 아직 없습니다."}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {premiumPreviewSectionPages.length > 0 ? (
                          premiumPreviewSectionPages.map((sectionPage, pageIndex) => (
                            <div
                              key={`premium-section-page-${pageIndex}`}
                              className="rounded-[28px] border border-slate-700 bg-white text-slate-900 shadow-[0_12px_32px_rgba(0,0,0,0.35)] overflow-hidden"
                            >
                              <div className="border-b border-slate-200 px-6 py-3 text-[11px] text-slate-500">
                                Page {pageIndex + 2} · Sections
                              </div>
                              <div className="p-6 space-y-5">
                                {sectionPage.map((section, sectionIndex) => (
                                  <div key={`${section.key}-${pageIndex}-${sectionIndex}`} className="space-y-2">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                      Section {pageIndex * 2 + sectionIndex + 1}
                                    </p>
                                    <h4 className="text-lg font-semibold break-words">
                                      {section.title.trim() || `제목 없는 섹션 ${pageIndex * 2 + sectionIndex + 1}`}
                                    </h4>
                                    <p className="text-sm leading-7 text-slate-700 whitespace-pre-wrap break-words">
                                      {compactPreviewText(section.body, 900) || "본문 없음"}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-[28px] border border-slate-700 bg-white text-slate-400 shadow-[0_12px_32px_rgba(0,0,0,0.35)] overflow-hidden">
                            <div className="border-b border-slate-200 px-6 py-3 text-[11px]">Page 2 · Sections</div>
                            <div className="p-6 text-sm">
                              섹션을 추가하면 본문 페이지 시안이 여기에 이어서 표시됩니다.
                            </div>
                          </div>
                        )}

                        {premiumPreviewVisualAssets.length > 0 && (
                          <div className="rounded-[28px] border border-slate-700 bg-white text-slate-900 shadow-[0_12px_32px_rgba(0,0,0,0.35)] overflow-hidden">
                            <div className="border-b border-slate-200 px-6 py-3 text-[11px] text-slate-500">
                              Page {premiumPreviewSectionPages.length + 2} · Visual Assets
                            </div>
                            <div className="p-6 grid gap-4 md:grid-cols-2">
                              {premiumPreviewVisualAssets.map((asset) => (
                                <div key={asset.id} className="rounded-2xl border border-slate-200 p-3 space-y-3">
                                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 min-h-[180px] flex items-center justify-center">
                                    {asset.downloadUrl ? (
                                      <img
                                        src={asset.downloadUrl}
                                        alt={asset.title}
                                        className="max-h-[164px] w-full rounded-lg object-cover"
                                      />
                                    ) : (
                                      <div className="text-center text-sm text-slate-400">미리보기 없음</div>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium break-words">{asset.title}</p>
                                    <p className="mt-1 text-xs text-slate-400">
                                      {asset.assetType === "chart_image" ? "차트 이미지" : "첨부 이미지"}
                                    </p>
                                    <p className="mt-2 text-sm leading-6 text-slate-600 break-words">
                                      {compactPreviewText(asset.description, 180) || "설명 없음"}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {premiumPreviewAttachmentAssets.length > 0 && (
                          <div className="rounded-[28px] border border-slate-700 bg-white text-slate-900 shadow-[0_12px_32px_rgba(0,0,0,0.35)] overflow-hidden">
                            <div className="border-b border-slate-200 px-6 py-3 text-[11px] text-slate-500">
                              Page {premiumPreviewSectionPages.length + (premiumPreviewVisualAssets.length > 0 ? 3 : 2)} · Attachments
                            </div>
                            <div className="p-6 space-y-3">
                              <p className="text-sm font-medium">참고 첨부 자료</p>
                              <div className="space-y-2">
                                {premiumPreviewAttachmentAssets.map((asset, index) => (
                                  <div key={asset.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                                    <p className="text-sm font-medium break-words">
                                      {index + 1}. {asset.title}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-400 break-all">
                                      {asset.originalName || "원본 파일명 없음"}
                                    </p>
                                    <p className="mt-2 text-sm leading-6 text-slate-600 break-words">
                                      {compactPreviewText(asset.description, 180) || "설명 없음"}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-400">섹션 구성</span>
                        <button
                          type="button"
                          onClick={() =>
                            setPremiumDocSections((prev) => [
                              ...prev,
                              {
                                key: `section-${prev.length + 1}`,
                                title: `새 섹션 ${prev.length + 1}`,
                                body: "",
                              },
                            ])
                          }
                          className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
                        >
                          섹션 추가
                        </button>
                      </div>

                      {premiumDocSections.length === 0 ? (
                        <p className="text-xs text-slate-500">섹션이 없습니다. 추가 후 저장하세요.</p>
                      ) : (
                        <div className="space-y-3">
                          {premiumDocSections.map((section, index) => (
                            <div
                              key={`${section.key}-${index}`}
                              className="p-3 rounded-lg bg-slate-900/70 border border-slate-700 space-y-2"
                            >
                              <div className="grid md:grid-cols-[1fr_2fr_auto] gap-2 items-start">
                                <input
                                  type="text"
                                  value={section.key}
                                  onChange={(e) =>
                                    setPremiumDocSections((prev) =>
                                      prev.map((item, i) => (i === index ? { ...item, key: e.target.value } : item))
                                    )
                                  }
                                  placeholder="section-key"
                                  className="rounded bg-slate-950 border border-slate-700 text-slate-300 text-xs px-2 py-2"
                                />
                                <input
                                  type="text"
                                  value={section.title}
                                  onChange={(e) =>
                                    setPremiumDocSections((prev) =>
                                      prev.map((item, i) => (i === index ? { ...item, title: e.target.value } : item))
                                    )
                                  }
                                  placeholder="섹션 제목"
                                  className="rounded bg-slate-950 border border-slate-700 text-slate-200 text-sm px-3 py-2"
                                />
                                <button
                                  type="button"
                                  onClick={() => setPremiumDocSections((prev) => prev.filter((_, i) => i !== index))}
                                  className="text-xs px-2 py-2 rounded bg-slate-700 text-slate-300 hover:bg-red-500/20"
                                >
                                  삭제
                                </button>
                              </div>
                              <textarea
                                value={section.body}
                                onChange={(e) =>
                                  setPremiumDocSections((prev) =>
                                    prev.map((item, i) => (i === index ? { ...item, body: e.target.value } : item))
                                  )
                                }
                                rows={5}
                                placeholder="섹션 본문"
                                className="w-full rounded bg-slate-950 border border-slate-700 text-slate-200 text-sm px-3 py-2"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
                      <div className="mb-4 space-y-3">
                        <p className="text-[11px] text-slate-400">첨부 자산 업로드</p>
                        <div className="grid md:grid-cols-[180px_1fr_auto] gap-2 items-end">
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-slate-500">자산 종류</span>
                            <select
                              value={premiumAssetType}
                              onChange={(e) => setPremiumAssetType(e.target.value as PremiumUploadAssetType)}
                              className="rounded bg-slate-950 border border-slate-700 text-slate-200 text-sm px-3 py-2"
                            >
                              <option value="chart_image">차트 이미지</option>
                              <option value="attachment_image">첨부 이미지</option>
                              <option value="attachment_pdf">첨부 PDF</option>
                            </select>
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-slate-500">파일 선택</span>
                            <input
                              key={premiumAssetInputKey}
                              type="file"
                              accept={premiumAssetType === "attachment_pdf" ? "application/pdf" : "image/png,image/jpeg,image/webp,image/gif"}
                              onChange={(e) => setPremiumAssetFile(e.target.files?.[0] ?? null)}
                              className="rounded bg-slate-950 border border-slate-700 text-slate-300 text-xs px-3 py-2 file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-slate-200"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={uploadPremiumAsset}
                            disabled={!premiumAssetFile || premiumAssetBusy}
                            className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 disabled:opacity-50"
                          >
                            {premiumAssetBusy ? "업로드 중..." : "자산 업로드"}
                          </button>
                        </div>
                        {premiumAssetFile && (
                          <p className="text-[11px] text-slate-500">
                            선택 파일: {premiumAssetFile.name} ({Math.ceil(premiumAssetFile.size / 1024)}KB)
                          </p>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 mb-2">발행 자산</p>
                      {premiumDocAssets.length === 0 ? (
                        <p className="text-[11px] text-slate-500 mb-4">저장된 자산이 없습니다. 문서를 저장한 뒤 최종 PDF를 발행해 주세요.</p>
                      ) : (
                        <ul className="space-y-2 mb-4">
                          {premiumDocAssets.map((asset) => {
                            const meta = getPremiumAssetMeta(asset.meta_json);
                            const draft = premiumAssetDrafts[asset.id] ?? { title: "", description: "" };
                            const originalName =
                              meta.original_name == null ? null : String(meta.original_name);
                            const savedTitle = meta.title == null ? "" : String(meta.title);
                            const savedDescription = meta.description == null ? "" : String(meta.description);
                            const isCover = meta.is_cover === true;
                            const displayTitle = draft.title.trim() || getPremiumAssetDefaultTitle(asset.asset_type);
                            const previewDescription = draft.description.trim();
                            const previewPlacement = getPremiumAssetPdfPlacement(asset.asset_type, isCover);
                            const editable = asset.asset_type !== "final_pdf";
                            const hasUnsavedPreviewChanges =
                              editable && (draft.title !== savedTitle || draft.description !== savedDescription);
                            const currentIndex = editablePremiumAssets.findIndex((item) => item.id === asset.id);
                            const prevAsset = editable && currentIndex > 0 ? editablePremiumAssets[currentIndex - 1] : null;
                            const nextAsset =
                              editable && currentIndex >= 0 && currentIndex < editablePremiumAssets.length - 1
                                ? editablePremiumAssets[currentIndex + 1]
                                : null;
                            const currentSortOrder =
                              typeof meta.sort_order === "number" ? meta.sort_order : Math.max(0, currentIndex);
                            const canAcceptDrop =
                              editable &&
                              premiumDraggedAssetId != null &&
                              premiumDraggedAssetId !== asset.id &&
                              draggedPremiumAsset != null;
                            const isDropTarget =
                              canAcceptDrop && premiumDropTarget?.assetId === asset.id;

                            return (
                              <li
                                key={asset.id}
                                id={`premium-asset-${asset.id}`}
                                draggable={editable}
                                onDragStart={() => {
                                  if (!editable) return;
                                  setPremiumDraggedAssetId(asset.id);
                                  setPremiumDropTarget(null);
                                }}
                                onDragEnd={() => {
                                  setPremiumDraggedAssetId(null);
                                  setPremiumDropTarget(null);
                                }}
                                onDragOver={(e) => {
                                  if (!canAcceptDrop) return;
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const position = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = "move";
                                  setPremiumDropTarget({ assetId: asset.id, position });
                                }}
                                onDrop={(e) => {
                                  if (!draggedPremiumAsset || premiumDropTarget?.assetId !== asset.id) return;
                                  e.preventDefault();
                                  setPremiumDraggedAssetId(null);
                                  setPremiumDropTarget(null);
                                  const reordered = insertItemByDropPosition(
                                    editablePremiumAssets,
                                    draggedPremiumAsset.id,
                                    asset.id,
                                    premiumDropTarget.position
                                  );
                                  const orderedIds = reordered.map((item) => item.id);
                                  const currentIds = editablePremiumAssets.map((item) => item.id);
                                  if (orderedIds.join("|") === currentIds.join("|")) return;
                                  void reorderPremiumAssetList(
                                    orderedIds,
                                    draggedPremiumAsset.id
                                  );
                                }}
                                className={`relative rounded border px-3 py-2 text-[11px] text-slate-400 transition ${
                                  isDropTarget
                                    ? "border-electric-blue/60 bg-electric-blue/5"
                                    : "border-slate-700 bg-slate-950/60"
                                } ${editable ? "cursor-move" : ""} ${premiumDraggedAssetId === asset.id ? "opacity-70" : ""} ${
                                  premiumHighlightedAssetId === asset.id ? "ring-2 ring-electric-blue border-electric-blue/70 bg-electric-blue/10" : ""
                                }`}
                              >
                                {isDropTarget && premiumDropTarget?.position === "before" && (
                                  <div className="absolute left-3 right-3 top-0 h-0.5 bg-electric-blue rounded-full" />
                                )}
                                {isDropTarget && premiumDropTarget?.position === "after" && (
                                  <div className="absolute left-3 right-3 bottom-0 h-0.5 bg-electric-blue rounded-full" />
                                )}
                                <div className="flex gap-3">
                                  <div className="shrink-0">
                                    {asset.download_url && (asset.asset_type === "chart_image" || asset.asset_type === "attachment_image") ? (
                                      <img
                                        src={asset.download_url}
                                        alt={originalName ?? asset.asset_type}
                                        className="h-20 w-20 rounded object-cover border border-slate-700 bg-slate-900"
                                      />
                                    ) : (
                                      <div className="h-20 w-20 rounded border border-slate-700 bg-slate-900/70 flex items-center justify-center text-[10px] text-slate-500 text-center px-2">
                                        {asset.asset_type === "attachment_pdf"
                                          ? "PDF"
                                          : asset.asset_type === "final_pdf"
                                            ? "최종 PDF"
                                            : "미리보기 없음"}
                                      </div>
                                    )}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span>
                                        {displayTitle}
                                        {isCover ? " · 대표" : ""}
                                        {" · "}
                                        {new Date(asset.created_at).toLocaleString("ko-KR")}
                                      </span>
                                      <div className="flex flex-wrap items-center gap-2">
                                        {editable && (
                                          <>
                                            <button
                                              type="button"
                                              disabled={!prevAsset || premiumAssetActionBusyId === asset.id}
                                              onClick={() =>
                                                prevAsset
                                                  ? reorderPremiumAssetList(
                                                      moveItemInArray(
                                                        editablePremiumAssets.map((item) => item.id),
                                                        currentIndex,
                                                        currentIndex - 1
                                                      ),
                                                      asset.id
                                                    )
                                                  : undefined
                                              }
                                              className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                                            >
                                              위로
                                            </button>
                                            <button
                                              type="button"
                                              disabled={!nextAsset || premiumAssetActionBusyId === asset.id}
                                              onClick={() =>
                                                nextAsset
                                                  ? reorderPremiumAssetList(
                                                      moveItemInArray(
                                                        editablePremiumAssets.map((item) => item.id),
                                                        currentIndex,
                                                        currentIndex + 1
                                                      ),
                                                      asset.id
                                                    )
                                                  : undefined
                                              }
                                              className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                                            >
                                              아래로
                                            </button>
                                            {(asset.asset_type === "chart_image" || asset.asset_type === "attachment_image") && (
                                              <button
                                                type="button"
                                                disabled={isCover || premiumAssetActionBusyId === asset.id}
                                                onClick={() => updatePremiumAssetMeta(asset.id, { isCover: true })}
                                                className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40"
                                              >
                                                {isCover ? "대표 이미지" : "대표 지정"}
                                              </button>
                                            )}
                                            <button
                                              type="button"
                                              disabled={premiumAssetActionBusyId === asset.id}
                                              onClick={() => deletePremiumAsset(asset.id)}
                                              className="px-2 py-1 rounded bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-40"
                                            >
                                              삭제
                                            </button>
                                          </>
                                        )}
                                        {asset.download_url ? (
                                          <a
                                            href={asset.download_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-electric-blue hover:text-white"
                                          >
                                            열기
                                          </a>
                                        ) : (
                                          <span className="text-slate-600">URL 없음</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="mt-1 break-all text-slate-500">
                                      {asset.storage_bucket ?? "—"} / {asset.storage_path ?? "—"}
                                    </div>
                                    <div className="mt-1 text-slate-600">
                                      원본 파일: {originalName ?? "—"}
                                      {editable ? ` · 순서 ${currentSortOrder}` : ""}
                                    </div>
                                    {editable && (
                                      <div className="mt-2 rounded border border-slate-800 bg-slate-950/80 px-3 py-2">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <p className="text-[10px] font-medium text-electric-blue">PDF 반영 미리보기</p>
                                          <span
                                            className={`rounded px-2 py-0.5 text-[10px] ${
                                              hasUnsavedPreviewChanges
                                                ? "bg-amber-500/15 text-amber-300"
                                                : "bg-emerald-500/15 text-emerald-300"
                                            }`}
                                          >
                                            {hasUnsavedPreviewChanges ? "미저장 변경 있음" : "저장 반영됨"}
                                          </span>
                                        </div>
                                        <p className="mt-1 text-[11px] text-slate-400">{previewPlacement}</p>
                                        <p className="mt-1 text-xs text-slate-200">{displayTitle}</p>
                                        <p className="mt-1 text-[11px] text-slate-500">
                                          {previewDescription || "설명 없음"}
                                        </p>
                                      </div>
                                    )}
                                    {editable && (
                                      <div className="mt-2 grid gap-2">
                                        <input
                                          type="text"
                                          value={draft.title}
                                          onChange={(e) =>
                                            setPremiumAssetDrafts((prev) => ({
                                              ...prev,
                                              [asset.id]: {
                                                ...(prev[asset.id] ?? {}),
                                                title: e.target.value,
                                                description: prev[asset.id]?.description ?? draft.description,
                                              },
                                            }))
                                          }
                                          placeholder="자산 제목(예: 이번 달 감응 흐름 차트)"
                                          className="rounded bg-slate-900 border border-slate-700 text-slate-200 text-xs px-3 py-2"
                                        />
                                        <textarea
                                          value={draft.description}
                                          onChange={(e) =>
                                            setPremiumAssetDrafts((prev) => ({
                                              ...prev,
                                              [asset.id]: {
                                                ...(prev[asset.id] ?? {}),
                                                title: prev[asset.id]?.title ?? draft.title,
                                                description: e.target.value,
                                              },
                                            }))
                                          }
                                          rows={2}
                                          placeholder="PDF에 함께 출력할 설명 문구"
                                          className="rounded bg-slate-900 border border-slate-700 text-slate-200 text-xs px-3 py-2"
                                        />
                                        <div className="flex justify-end">
                                          <button
                                            type="button"
                                            disabled={premiumAssetActionBusyId === asset.id || !hasUnsavedPreviewChanges}
                                            onClick={() => savePremiumAssetDraft(asset.id)}
                                            className="px-2 py-1 rounded bg-electric-blue/20 text-electric-blue hover:bg-electric-blue/30 disabled:opacity-40"
                                          >
                                            {hasUnsavedPreviewChanges ? "설명 저장" : "저장됨"}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                    {editable && (
                                      <div className="mt-1 text-slate-600">
                                        카드를 끌어 원하는 자산 위에 놓으면 그 위치로 이동합니다.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      <p className="text-[11px] text-slate-400 mb-2">작업 타임라인</p>
                      {premiumDocActions.length === 0 ? (
                        <p className="text-[11px] text-slate-500 mb-4">아직 기록된 작업 이력이 없습니다.</p>
                      ) : (
                        <ul className="space-y-2 mb-4">
                          {premiumDocActions.map((action) => {
                            const formatted = formatPremiumActionItem(action);
                            const canFocusAsset =
                              typeof formatted.targetAssetId === "string" &&
                              premiumDocAssets.some((asset) => asset.id === formatted.targetAssetId);
                            const canCompareDocumentVersion =
                              typeof formatted.targetDocumentVersion === "number" &&
                              premiumDocHistory.some((doc) => doc.version === formatted.targetDocumentVersion);
                            return (
                              <li
                                key={action.id}
                                className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-3"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-slate-200">{formatted.title}</p>
                                    {formatted.details.length > 0 && (
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {formatted.details.map((detail, index) => (
                                          <span
                                            key={`${action.id}-${index}`}
                                            className="inline-flex rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400"
                                          >
                                            {detail}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    {canFocusAsset && formatted.targetAssetId && (
                                      <button
                                        type="button"
                                        onClick={() => focusPremiumAssetCard(formatted.targetAssetId!)}
                                        className="mt-2 text-[11px] text-electric-blue hover:text-white"
                                      >
                                        관련 자산으로 이동
                                      </button>
                                    )}
                                    {canCompareDocumentVersion && typeof formatted.targetDocumentVersion === "number" && (
                                      <button
                                        type="button"
                                        onClick={() => setPremiumCompareVersion(formatted.targetDocumentVersion!)}
                                        className="mt-2 ml-3 text-[11px] text-cyan-300 hover:text-white"
                                      >
                                        이 버전과 비교
                                      </button>
                                    )}
                                  </div>
                                  <div className="text-right text-[10px] text-slate-500">
                                    <p>{new Date(action.created_at).toLocaleString("ko-KR")}</p>
                                    <p>{action.actor ?? "system"}</p>
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      <details className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                        <summary className="text-[11px] text-slate-400 cursor-pointer select-none">
                          소스 스냅샷 (자동 수집 데이터 · 용도 안내)
                        </summary>
                        <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">
                          문서 저장 시 해당 닉네임의 최근 자각 기록·AI 멘트·주별 통계를 JSON으로 고정해 둔 참고 자료입니다. PDF에
                          그대로 인쇄되지는 않으며, 초안 자동 생성·검수·이후 수정 비교 시 「당시 어떤 데이터로 썼는지」를
                          확인하는 용도입니다. 아래 「발행 자산」에서 업로드한 이미지·PDF만 최종 발행물에 포함됩니다.
                        </p>
                        <pre className="mt-2 text-[10px] text-slate-600 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                          {premiumDocSnapshot ? JSON.stringify(premiumDocSnapshot, null, 2) : "스냅샷 없음 (문서 저장 후 생성)"}
                        </pre>
                      </details>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
        {tab === "ai_content" && (
          <>
            <p className="text-xs text-slate-500 mb-4">
              AI 생성 콘텐츠 (ai_generated_content). 총 {aiTotal}건. 유형별: {Object.entries(aiStats)
                .map(([k, v]) => `${k}=${v}`)
                .join(", ") || "—"}
            </p>
            {aiContentLoading ? (
              <p className="text-slate-500 py-8">불러오는 중...</p>
            ) : (
              <ul className="space-y-3">
                {aiContent.map((row) => (
                  <li
                    key={row.id}
                    className="p-3 rounded-lg bg-slate-800/60 border border-slate-700"
                  >
                    <div className="flex justify-between items-start gap-2 text-xs text-slate-500">
                      <span>{row.nickname}</span>
                      <span>{row.content_type}</span>
                      <time>{new Date(row.created_at).toLocaleString("ko-KR")}</time>
                    </div>
                    {formatAiContentAdminLines(row.meta).map((line, i) => (
                      <p key={i} className="mt-0.5 text-[11px] text-amber-100/90 font-mono break-all">
                        [내부] {line}
                      </p>
                    ))}
                    <p className="mt-1 text-sm text-slate-300 break-words line-clamp-3">
                      {typeof row.content === "string" ? row.content : JSON.stringify(row.content)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {tab === "ai_content" && !aiContentLoading && aiContent.length === 0 && (
              <p className="text-slate-500 py-8 text-center">AI 콘텐츠가 없습니다.</p>
            )}
          </>
        )}
        <p className="mt-6 text-center">
          <a href="/" className="text-sm text-slate-500 hover:text-slate-300">
            ← 메인으로
          </a>
        </p>
      </div>
    </div>
  );
}
