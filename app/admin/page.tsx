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

type AdminTab = "records" | "members" | "profiles" | "ai_content" | "moderation_quarantine";

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
  };

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
    if (loggedIn === true && tab === "moderation_quarantine") loadModerationArchive();
  }, [loggedIn, tab, loadModerationArchive]);

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
      <div className="max-w-2xl mx-auto">
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
                    <div className="text-sm font-medium text-slate-200">{m.nickname}</div>
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
