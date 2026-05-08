"use client";

import { useState } from "react";
import { Users, X, AlertTriangle } from "lucide-react";

type Props = {
  currentNickname: string;
  sharedNickname: string | null;
  onSharedNicknameSet: (nickname: string | null) => void;
  onExperimentEnded?: () => void;
};

export default function ResonanceNicknameSection({
  currentNickname,
  sharedNickname,
  onSharedNicknameSet,
  onExperimentEnded,
}: Props) {
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [endPassword, setEndPassword] = useState("");
  const [ending, setEnding] = useState(false);

  const handleUse = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = nickname.trim().slice(0, 20);
    const p = password.trim();
    if (!n || !p) {
      setError("닉네임과 비밀번호를 모두 입력해 주세요.");
      return;
    }
    setError(null);
    setVerifying(true);
    try {
      const res = await fetch("/api/participant/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: n, password: p }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "닉네임 또는 비밀번호가 일치하지 않습니다.");
        return;
      }
      onSharedNicknameSet(n);
      setPassword("");
    } finally {
      setVerifying(false);
    }
  };

  const handleEndExperiment = async () => {
    const nick = sharedNickname?.trim();
    if (!nick) return;
    const p = endPassword.trim();
    if (!p) {
      setError("비밀번호를 입력해 주세요.");
      return;
    }
    setError(null);
    setEnding(true);
    try {
      const res = await fetch("/api/experiment/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nick, password: p }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "실험 종료에 실패했습니다.");
        return;
      }
      setShowEndConfirm(false);
      setEndPassword("");
      onExperimentEnded?.();
    } finally {
      setEnding(false);
    }
  };

  return (
    <section className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2">
          <Users className="w-4 h-4" />
          감응 닉네임 (공동)
        </h3>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="px-2.5 py-1 rounded-lg bg-slate-700/60 text-slate-300 text-xs hover:bg-slate-700"
        >
          {open ? "닫기" : "보기"}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        친구·연인과 닉네임과 비밀번호를 공유해 같은 닉네임으로 감응 시도 실험을 함께 할 수 있습니다. 공동 닉네임으로 기록하면 해당 닉네임에 저장됩니다.
      </p>

      {!open ? (
        <div className="text-xs text-slate-500">
          {sharedNickname
            ? `사용 중: ${sharedNickname}`
            : currentNickname
              ? `현재 닉네임: ${currentNickname}`
              : "현재 닉네임이 없습니다."}
        </div>
      ) : (
        <>
          {!sharedNickname ? (
            <form onSubmit={handleUse} className="flex flex-wrap gap-2 items-end">
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] text-slate-400">닉네임</span>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="공동 닉네임"
                  className="rounded-lg bg-slate-900 border border-slate-600 text-slate-200 text-sm px-3 py-2 w-28"
                  maxLength={20}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] text-slate-400">비밀번호</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호"
                  className="rounded-lg bg-slate-900 border border-slate-600 text-slate-200 text-sm px-3 py-2 w-28"
                  autoComplete="current-password"
                />
              </label>
              <button
                type="submit"
                disabled={verifying}
                className="px-3 py-2 rounded-lg bg-electric-blue/80 text-white text-sm font-medium hover:bg-electric-blue disabled:opacity-50"
              >
                {verifying ? "확인 중…" : "사용하기"}
              </button>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-200">사용 중: <strong>{sharedNickname}</strong></span>
              <button
                type="button"
                onClick={() => onSharedNicknameSet(null)}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" /> 사용 해제
              </button>
            </div>
          )}

          {sharedNickname && (
            <div className="pt-2 border-t border-slate-700/50">
              <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                저장된 기록에 비방·혐오 등 참여자 중 한 명이라도 동의할 수 없는 내용이 있으면, 실험을 종료할 수 있습니다. 종료 시 감응실험실이 사라집니다. (한시적 실험 운영)
              </p>
              {!showEndConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowEndConfirm(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs hover:bg-slate-600"
                >
                  실험 종료합니다
                </button>
              ) : (
                <div className="flex flex-wrap gap-2 items-end">
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-slate-400">비밀번호 확인</span>
                    <input
                      type="password"
                      value={endPassword}
                      onChange={(e) => setEndPassword(e.target.value)}
                      placeholder="공동 닉네임 비밀번호"
                      className="rounded-lg bg-slate-900 border border-slate-600 text-slate-200 text-sm px-3 py-2 w-36"
                      autoComplete="current-password"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleEndExperiment}
                    disabled={ending}
                    className="px-3 py-2 rounded-lg bg-red-900/60 text-red-200 text-sm hover:bg-red-900/80 disabled:opacity-50"
                  >
                    {ending ? "처리 중…" : "실험 종료하기"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowEndConfirm(false); setEndPassword(""); setError(null); }}
                    className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm"
                  >
                    취소
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </section>
  );
}
