"use client";

import { useState, useEffect, useCallback } from "react";

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
  | "image_audit";

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
  const [auditNick, setAuditNick] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [entitlementActions, setEntitlementActions] = useState<EntitlementActionRow[]>([]);
  const [imageUsageRows, setImageUsageRows] = useState<ImageUsageRow[]>([]);
  const [imageAssetRows, setImageAssetRows] = useState<ImageAssetAuditRow[]>([]);

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
      // 탭 진입 시 기존 입력값이 있으면 자동 조회
      if (entNick.trim()) loadEntitlements();
      else {
        setEntRows([]);
        setEntError("");
      }
    }
  }, [loggedIn, tab, entNick, loadEntitlements]);

  useEffect(() => {
    if (loggedIn === true && tab === "moderation_quarantine") loadModerationArchive();
  }, [loggedIn, tab, loadModerationArchive]);

  useEffect(() => {
    if (loggedIn === true && tab === "image_audit") loadImageAudit();
  }, [loggedIn, tab, loadImageAudit]);

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 pb-8">
      <div className={`mx-auto ${tab === "image_audit" ? "max-w-4xl" : "max-w-2xl"}`}>
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
                    {typeof row.meta === "object" &&
                      row.meta !== null &&
                      (row.meta as { source?: string }).source === "rule" && (
                        <p className="mt-1 text-[11px] text-amber-200">
                          일시적 문제로 룰베이스 제공
                        </p>
                      )}
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
