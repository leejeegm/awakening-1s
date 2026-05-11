"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type EligibilityResponse = {
  qualifies: boolean;
  consecutiveWeeks: number;
  qualifiesFromWeek: string | null;
  ctaState: "enabled" | "locked";
  message: string;
  weeklyDayCounts?: { week: string; distinctDays: number; qualifies: boolean }[];
};

type RequestItem = {
  id: string;
  status: string;
  payment_status: string;
  downloadable: boolean;
  requested_at: string;
  updated_at: string;
};

type Props = {
  nickname?: string;
  participantAuthHash?: string;
  onParticipantAuthHashVerified?: (hash: string) => void;
};

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function statusLabel(item: RequestItem) {
  if (item.status === "ready" && item.downloadable) return "다운로드 가능";
  if (item.status === "in_progress") return "작성 중";
  if (item.status === "approved") return "승인 완료";
  if (item.status === "paid_pending" || item.payment_status === "pending_manual_check") return "결재 확인 중";
  if (item.status === "requested") return "신청 접수";
  if (item.status === "rejected") return "반려";
  return item.status;
}

export default function PremiumReportCTA({
  nickname = "",
  participantAuthHash = "",
  onParticipantAuthHashVerified,
}: Props) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [requestMessage, setRequestMessage] = useState("");

  const trimmedNickname = nickname.trim();
  const latestRequest = requests[0] ?? null;

  const loadState = useCallback(async () => {
    if (!trimmedNickname || !participantAuthHash) return;

    setEligibilityLoading(true);
    setRequestsLoading(true);
    setAuthError("");
    setRequestError("");

    try {
      const [eligibilityRes, requestsRes] = await Promise.all([
        fetch(
          `/api/premium-report/eligibility?nickname=${encodeURIComponent(trimmedNickname)}&authHash=${encodeURIComponent(
            participantAuthHash
          )}`
        ),
        fetch(
          `/api/premium-report/request?nickname=${encodeURIComponent(trimmedNickname)}&authHash=${encodeURIComponent(
            participantAuthHash
          )}`
        ),
      ]);

      const eligibilityJson = (await eligibilityRes.json().catch(() => ({}))) as EligibilityResponse & {
        error?: string;
      };
      const requestsJson = (await requestsRes.json().catch(() => ({}))) as { items?: RequestItem[]; error?: string };

      if (eligibilityRes.ok) {
        setEligibility(eligibilityJson);
      } else {
        setEligibility(null);
        setAuthError(eligibilityJson.error ?? "자격 정보를 불러오지 못했습니다.");
      }

      if (requestsRes.ok) {
        setRequests(Array.isArray(requestsJson.items) ? requestsJson.items : []);
      } else {
        setRequests([]);
        if (!authError) setRequestError(requestsJson.error ?? "신청 상태를 불러오지 못했습니다.");
      }
    } finally {
      setEligibilityLoading(false);
      setRequestsLoading(false);
    }
  }, [trimmedNickname, participantAuthHash, authError]);

  useEffect(() => {
    if (!open) return;
    if (!trimmedNickname || !participantAuthHash) return;
    loadState();
  }, [open, trimmedNickname, participantAuthHash, loadState]);

  const verifyAndLoad = async () => {
    if (!trimmedNickname) {
      setAuthError("먼저 닉네임으로 기록을 남겨 주세요.");
      return;
    }
    if (!password.trim()) {
      setAuthError("비밀번호를 입력해 주세요.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");
    try {
      const hash = await sha256Hex(password);
      const verifyRes = await fetch("/api/participant/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: trimmedNickname, password }),
      });
      const verifyJson = (await verifyRes.json().catch(() => ({}))) as { ok?: boolean; error?: string };

      if (!verifyRes.ok || !verifyJson.ok) {
        setAuthError(verifyJson.error ?? "비밀번호 확인에 실패했습니다.");
        return;
      }

      onParticipantAuthHashVerified?.(hash);
      setPassword("");
      setRequestMessage("인증되었습니다. 자격과 신청 상태를 확인합니다.");
    } finally {
      setAuthLoading(false);
    }
  };

  const submitRequest = async () => {
    if (!trimmedNickname || !participantAuthHash) {
      setRequestError("먼저 비밀번호 인증을 완료해 주세요.");
      return;
    }

    setRequestBusy(true);
    setRequestError("");
    setRequestMessage("");

    try {
      const res = await fetch("/api/premium-report/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: trimmedNickname,
          authHash: participantAuthHash,
          consent: true,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        alreadyExists?: boolean;
      };

      if (!res.ok || !json.ok) {
        setRequestError(json.error ?? "신청에 실패했습니다.");
        return;
      }

      setRequestMessage(json.alreadyExists ? "이미 진행 중인 신청이 있습니다." : "유료 보고서 신청이 접수되었습니다.");
      await loadState();
    } finally {
      setRequestBusy(false);
    }
  };

  const handleDownload = () => {
    if (!latestRequest || !participantAuthHash) return;
    window.location.href = `/api/premium-report/download?id=${encodeURIComponent(latestRequest.id)}&nickname=${encodeURIComponent(
      trimmedNickname
    )}&authHash=${encodeURIComponent(participantAuthHash)}`;
  };

  const buttonClass = useMemo(() => {
    if (eligibility?.qualifies) {
      return "w-full py-3 rounded-lg bg-deep-violet text-white font-semibold text-[12px] hover:bg-deep-violet/90 transition";
    }
    return "w-full py-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-[12px] hover:bg-slate-700 transition";
  }, [eligibility?.qualifies]);

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className={buttonClass}>
        나의 자깨 감응 보고서 보기(유료)
      </button>

      {open && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-3 space-y-3">
          {!trimmedNickname && (
            <p className="text-xs text-slate-400">먼저 닉네임으로 기록을 남기면 유료 보고서 자격을 확인할 수 있습니다.</p>
          )}

          {trimmedNickname && !participantAuthHash && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">
                유료 보고서 자격과 신청 상태를 확인하려면 닉네임 비밀번호 인증이 필요합니다.
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="닉네임 비밀번호"
                  className="flex-1 min-w-[12rem] rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-sm px-3 py-2"
                />
                <button
                  type="button"
                  onClick={verifyAndLoad}
                  disabled={authLoading}
                  className="px-3 py-2 rounded-lg bg-electric-blue/80 text-white text-sm font-medium hover:bg-electric-blue disabled:opacity-50"
                >
                  {authLoading ? "인증 중..." : "인증 후 확인"}
                </button>
              </div>
            </div>
          )}

          {participantAuthHash && (
            <div className="space-y-3">
              {(eligibilityLoading || requestsLoading) && (
                <p className="text-xs text-slate-500">유료 보고서 자격과 신청 상태를 확인하는 중...</p>
              )}

              {eligibility && (
                <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 space-y-2">
                  <p className="text-sm text-slate-200">{eligibility.message}</p>
                  {eligibility.weeklyDayCounts && eligibility.weeklyDayCounts.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                      {eligibility.weeklyDayCounts.map((row) => (
                        <span
                          key={row.week}
                          className={`rounded-full px-2 py-1 ${
                            row.qualifies ? "bg-deep-violet/30 text-slate-200" : "bg-slate-700 text-slate-400"
                          }`}
                        >
                          {row.week} · {row.distinctDays}일
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {latestRequest && (
                <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 space-y-1">
                  <p className="text-xs text-slate-500">현재 신청 상태</p>
                  <p className="text-sm text-slate-200">{statusLabel(latestRequest)}</p>
                  <p className="text-[11px] text-slate-500">
                    최근 업데이트: {new Date(latestRequest.updated_at).toLocaleString("ko-KR")}
                  </p>
                </div>
              )}

              {!latestRequest && eligibility?.qualifies && (
                <button
                  type="button"
                  onClick={submitRequest}
                  disabled={requestBusy}
                  className="w-full px-3 py-2 rounded-lg bg-deep-violet/80 text-white text-sm font-medium hover:bg-deep-violet disabled:opacity-50"
                >
                  {requestBusy ? "신청 중..." : "유료 보고서 신청하기"}
                </button>
              )}

              {latestRequest?.status === "ready" && latestRequest.downloadable && (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="w-full px-3 py-2 rounded-lg bg-electric-blue/80 text-white text-sm font-medium hover:bg-electric-blue"
                >
                  나의 자깨 감응 보고서 다운로드
                </button>
              )}
            </div>
          )}

          {(authError || requestError || requestMessage) && (
            <p className={`text-xs ${authError || requestError ? "text-red-400" : "text-slate-400"}`}>
              {authError || requestError || requestMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
