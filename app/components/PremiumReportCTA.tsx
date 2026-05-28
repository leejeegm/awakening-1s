"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const AUTH_HASH_STORAGE_PREFIX = "participant_auth_hash_v1";

type EligibilityResponse = {
  qualifies: boolean;
  qualifiesWeekly?: boolean;
  qualifiesRolling?: boolean;
  consecutiveWeeks: number;
  qualifiesFromWeek: string | null;
  ctaState: "enabled" | "locked";
  message: string;
  weeklyDayCounts?: { week: string; distinctDays: number; qualifies: boolean }[];
  rolling?: {
    windowDays: number;
    minRecords: number;
    recordCount: number;
    windowFrom: string;
    windowTo: string;
    qualifies: boolean;
  };
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
  if (item.status === "ready") return "발행 완료";
  if (item.status === "in_progress") return "작성 중";
  if (item.status === "approved") return "승인 완료";
  if (item.status === "paid_pending" || item.payment_status === "pending_manual_check") return "결재 확인 중";
  if (item.status === "requested") return "신청 접수";
  if (item.status === "rejected") return "반려";
  if (item.status === "expired") return "만료";
  return item.status;
}

function paymentStatusLabel(item: RequestItem) {
  if (item.payment_status === "confirmed") return "결재 확인 완료";
  if (item.payment_status === "pending_manual_check") return "결재 확인 대기";
  if (item.payment_status === "failed") return "결재 실패";
  if (item.payment_status === "refunded") return "환불 완료";
  if (item.payment_status === "unpaid") return "미결재";
  return item.payment_status;
}

function buildPaymentProgressGuide(item: RequestItem | null, qualifies?: boolean): string {
  if (!item) {
    if (qualifies === true) {
      return "유료 보고서 신청 내역이 없습니다. 아래 「유료 보고서 신청하기」로 신청할 수 있습니다.";
    }
    if (qualifies === false) {
      return "유료 보고서 신청 내역이 없습니다. 자격 요건을 충족하면 아래에서 신청할 수 있습니다.";
    }
    return "유료 보고서 신청 내역이 없습니다. 「신청 및 결재 확인」을 누른 뒤 자격과 신청 버튼 상태를 확인해 주세요.";
  }
  if (item.status === "ready" && item.downloadable) {
    return "보고서가 준비되었습니다. 아래 「나의 자깨 감응 보고서 다운로드」로 받을 수 있습니다.";
  }
  if (item.status === "ready") {
    return "발행은 완료되었으나 아직 다운로드 가능 상태가 아닙니다. 잠시 후 다시 확인해 주세요.";
  }
  if (item.status === "in_progress") {
    return "결재가 확인되어 보고서를 작성 중입니다. 완료되면 다운로드가 열립니다.";
  }
  if (item.status === "approved") {
    return "신청이 승인되었습니다. 곧 보고서 작성이 시작됩니다.";
  }
  if (item.status === "paid_pending" || item.payment_status === "pending_manual_check") {
    return "신청이 접수되었습니다. 입금·결재 확인이 진행 중이며, 확인이 끝나면 다음 단계로 넘어갑니다.";
  }
  if (item.status === "requested") {
    return "신청이 접수되었습니다. 안내에 따라 결재를 진행해 주시고, 「신청 및 결재 확인」으로 상태를 다시 확인할 수 있습니다.";
  }
  if (item.status === "rejected") {
    return "이전 신청이 반려되었습니다. 사유 확인 후 다시 신청할 수 있습니다.";
  }
  if (item.status === "expired") {
    return "이전 신청이 만료되었습니다. 필요 시 다시 신청해 주세요.";
  }
  return `현재 진행: 신청 ${statusLabel(item)}, 결재 ${paymentStatusLabel(item)}`;
}

function buildConfirmSummary(
  authenticated: boolean,
  eligibility: EligibilityResponse | null,
  latestRequest: RequestItem | null
): string {
  if (!authenticated) {
    return "비밀번호 인증이 필요합니다. 아래 입력란에 닉네임 비밀번호를 입력한 뒤 「인증 후 확인」을 누르거나, 「자각 기록 보기」에서 조회를 마친 뒤 「신청 및 결재 확인」을 다시 눌러 주세요.";
  }
  const parts: string[] = ["[인증 완료] 유료 보고서 상태를 확인했습니다."];
  if (eligibility) {
    if (eligibility.qualifies) {
      parts.push(`자격: 충족 — ${eligibility.message} 「유료 보고서 신청하기」가 표시됩니다.`);
      if (eligibility.qualifiesRolling && !eligibility.qualifiesWeekly && eligibility.rolling) {
        parts.push(
          `(완화 기준) 최근 ${eligibility.rolling.windowDays}일 기록 ${eligibility.rolling.recordCount}회 — 필요 ${eligibility.rolling.minRecords}회`
        );
      }
    } else {
      const need =
        eligibility.weeklyDayCounts?.filter((w) => !w.qualifies).length ?? 0;
      parts.push(
        `자격: 미충족 — 최근 4주 모두 주 3일 이상 기록이 필요합니다. (조건 미달 주: ${need}개)`
      );
      if (eligibility.rolling) {
        parts.push(
          `완화 기준: 최근 ${eligibility.rolling.windowDays}일 ${eligibility.rolling.minRecords}회 이상 (현재 ${eligibility.rolling.recordCount}회)`
        );
      }
      parts.push(`안내: ${eligibility.message}`);
    }
  }
  parts.push(`결재·진행: ${buildPaymentProgressGuide(latestRequest, eligibility?.qualifies)}`);
  if (latestRequest) {
    parts.push(
      `상세 — 신청 ${statusLabel(latestRequest)}, 결재 ${paymentStatusLabel(latestRequest)} (${new Date(latestRequest.updated_at).toLocaleString("ko-KR")} 갱신)`
    );
  }
  return parts.join("\n");
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
  const [statusMessage, setStatusMessage] = useState("");
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  const trimmedNickname = nickname.trim();
  const isAuthenticated = !!participantAuthHash.trim();
  const latestRequest = requests[0] ?? null;
  const hasActiveRequest =
    !!latestRequest &&
    latestRequest.status !== "rejected" &&
    latestRequest.status !== "expired";
  const canSubmitNewRequest = !!eligibility?.qualifies && !hasActiveRequest;
  const isChecking = eligibilityLoading || requestsLoading;

  const applyBlockReason = (() => {
    if (!eligibility) return "먼저 「신청 및 결재 확인」을 눌러 자격을 확인해 주세요.";
    if (!eligibility.qualifies) {
      return "아직 신청 자격이 없습니다. 위 「자격 요건」을 충족하면 신청할 수 있습니다.";
    }
    if (hasActiveRequest) {
      return "진행 중인 신청이 있습니다. 결재·진행 상태를 확인해 주세요.";
    }
    return null;
  })();

  const loadState = useCallback(
    async (authHashOverride?: string): Promise<boolean> => {
      const hash = (authHashOverride ?? participantAuthHash).trim();
      if (!trimmedNickname) {
        setAuthError("먼저 닉네임으로 기록을 남겨 주세요.");
        setStatusMessage("닉네임으로 기록을 남긴 뒤 유료 보고서를 이용할 수 있습니다.");
        return false;
      }
      if (!hash) {
        setAuthError("");
        setRequestError("");
        setStatusMessage(buildConfirmSummary(false, null, null));
        return false;
      }

      setEligibilityLoading(true);
      setRequestsLoading(true);
      setAuthError("");
      setRequestError("");

      let ok = true;
      let nextEligibility: EligibilityResponse | null = null;
      let nextRequests: RequestItem[] = [];
      const errors: string[] = [];

      try {
        const [eligibilityRes, requestsRes] = await Promise.all([
          fetch(
            `/api/premium-report/eligibility?nickname=${encodeURIComponent(trimmedNickname)}&authHash=${encodeURIComponent(hash)}`
          ),
          fetch(
            `/api/premium-report/request?nickname=${encodeURIComponent(trimmedNickname)}&authHash=${encodeURIComponent(hash)}`
          ),
        ]);

        const eligibilityJson = (await eligibilityRes.json().catch(() => ({}))) as EligibilityResponse & {
          error?: string;
          requiresAuth?: boolean;
        };
        const requestsJson = (await requestsRes.json().catch(() => ({}))) as {
          items?: RequestItem[];
          error?: string;
          requiresAuth?: boolean;
        };

        if (eligibilityRes.ok) {
          nextEligibility = eligibilityJson;
          setEligibility(eligibilityJson);
        } else {
          setEligibility(null);
          ok = false;
          errors.push(eligibilityJson.error ?? "자격 정보를 불러오지 못했습니다.");
          if (eligibilityRes.status === 401 || eligibilityJson.requiresAuth) {
            errors.push("비밀번호 인증이 만료되었을 수 있습니다. 다시 인증해 주세요.");
          }
        }

        if (requestsRes.ok) {
          nextRequests = Array.isArray(requestsJson.items) ? requestsJson.items : [];
          setRequests(nextRequests);
        } else {
          setRequests([]);
          ok = false;
          errors.push(requestsJson.error ?? "신청·결재 상태를 불러오지 못했습니다.");
        }

        if (errors.length > 0) {
          const msg = errors.join(" ");
          setAuthError(msg);
          setStatusMessage(`[확인 실패] ${msg}`);
        } else {
          setStatusMessage(
            buildConfirmSummary(true, nextEligibility, nextRequests[0] ?? null)
          );
          setLastCheckedAt(new Date().toLocaleString("ko-KR"));
        }
      } catch {
        ok = false;
        const msg = "네트워크 오류로 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.";
        setAuthError(msg);
        setStatusMessage(`[확인 실패] ${msg}`);
        setEligibility(null);
        setRequests([]);
      } finally {
        setEligibilityLoading(false);
        setRequestsLoading(false);
      }

      return ok;
    },
    [trimmedNickname, participantAuthHash]
  );

  const handleConfirmClick = async () => {
    setRequestError("");
    if (!trimmedNickname) {
      setStatusMessage("먼저 닉네임으로 자각 기록을 남겨 주세요.");
      setAuthError("먼저 닉네임으로 기록을 남겨 주세요.");
      return;
    }
    if (!isAuthenticated) {
      setStatusMessage(buildConfirmSummary(false, null, null));
      return;
    }
    setStatusMessage("유료 보고서 자격과 신청·결재 상태를 확인하는 중...");
    await loadState();
  };

  useEffect(() => {
    if (!open || !trimmedNickname || isAuthenticated) return;
    try {
      const stored = sessionStorage.getItem(`${AUTH_HASH_STORAGE_PREFIX}:${trimmedNickname}`);
      if (stored?.trim()) onParticipantAuthHashVerified?.(stored.trim());
    } catch {
      /* ignore */
    }
  }, [open, trimmedNickname, isAuthenticated, onParticipantAuthHashVerified]);

  useEffect(() => {
    if (!open || !trimmedNickname || !isAuthenticated) return;
    void loadState();
  }, [open, trimmedNickname, isAuthenticated, loadState]);

  const verifyAndLoad = async () => {
    if (!trimmedNickname) {
      setAuthError("먼저 닉네임으로 기록을 남겨 주세요.");
      setStatusMessage("먼저 닉네임으로 자각 기록을 남겨 주세요.");
      return;
    }
    if (!password.trim()) {
      setAuthError("비밀번호를 입력해 주세요.");
      setStatusMessage("비밀번호를 입력한 뒤 「인증 후 확인」을 눌러 주세요.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");
    setRequestError("");
    setStatusMessage("비밀번호를 확인하는 중...");
    try {
      const hash = await sha256Hex(password);
      const verifyRes = await fetch("/api/participant/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: trimmedNickname, password }),
      });
      const verifyJson = (await verifyRes.json().catch(() => ({}))) as { ok?: boolean; error?: string };

      if (!verifyRes.ok || !verifyJson.ok) {
        const msg = verifyJson.error ?? "비밀번호 확인에 실패했습니다.";
        setAuthError(msg);
        setStatusMessage(`[인증 실패] ${msg}`);
        return;
      }

      onParticipantAuthHashVerified?.(hash);
      setPassword("");
      setStatusMessage("[인증 완료] 신청·결재 상태를 불러오는 중...");
      await loadState(hash);
    } finally {
      setAuthLoading(false);
    }
  };

  const submitRequest = async () => {
    if (!trimmedNickname || !participantAuthHash) {
      setRequestError("먼저 비밀번호 인증을 완료해 주세요.");
      setStatusMessage("먼저 비밀번호 인증을 완료해 주세요.");
      return;
    }

    setRequestBusy(true);
    setRequestError("");
    setStatusMessage("유료 보고서 신청을 접수하는 중...");

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
        const msg = json.error ?? "신청에 실패했습니다.";
        setRequestError(msg);
        setStatusMessage(`[신청 실패] ${msg}`);
        return;
      }

      setStatusMessage(
        json.alreadyExists
          ? "[신청 안내] 이미 진행 중인 신청이 있습니다. 아래 결재·진행 상태를 확인해 주세요."
          : "[신청 완료] 유료 보고서 신청이 접수되었습니다. 결재 확인 후 다음 단계로 진행됩니다."
      );
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

  const statusTone =
    authError || requestError ? "border-red-500/40 bg-red-950/30" : "border-electric-blue/30 bg-slate-800/80";

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) {
              setStatusMessage("");
              setAuthError("");
              setRequestError("");
            }
            return next;
          });
        }}
        className={buttonClass}
      >
        나의 자깨 감응 보고서 보기(유료)
      </button>

      {open && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-3 space-y-3">
          {!trimmedNickname && (
            <p className="text-[12px] text-slate-400">먼저 닉네임으로 기록을 남기면 유료 보고서 자격을 확인할 수 있습니다.</p>
          )}

          {trimmedNickname && (
            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                onClick={handleConfirmClick}
                disabled={isChecking || authLoading}
                className="px-3 py-2 rounded-lg bg-electric-blue/80 text-white text-[12px] font-medium hover:bg-electric-blue disabled:opacity-50"
              >
                {isChecking || authLoading ? "확인 중..." : "신청 및 결재 확인"}
              </button>
              <span
                className={`text-[12px] ${isAuthenticated ? "text-emerald-400" : "text-amber-300"}`}
              >
                {isAuthenticated ? "비밀번호 인증됨" : "비밀번호 미인증"}
              </span>
            </div>
          )}

          {statusMessage && (
            <div className={`rounded-lg border p-3 ${statusTone}`}>
              <p className="text-[12px] text-slate-200 leading-relaxed whitespace-pre-wrap">{statusMessage}</p>
              {lastCheckedAt && isAuthenticated && !authError && !requestError && (
                <p className="text-[12px] text-slate-500 mt-1">마지막 확인: {lastCheckedAt}</p>
              )}
            </div>
          )}

          {trimmedNickname && !isAuthenticated && (
            <div className="space-y-2">
              <p className="text-[12px] text-slate-400">
                유료 보고서 자격과 신청·결재 상태를 확인하려면 닉네임 비밀번호 인증이 필요합니다.
              </p>
              <p className="text-[12px] text-slate-500">
                「신청 및 결재 확인」을 누르면 인증 안내가 표시됩니다. 「자각 기록 보기」에서 조회를 마친 경우에도 아래 입력란에 비밀번호를 입력해 주세요.
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
                  className="px-3 py-2 rounded-lg bg-deep-violet/80 text-white text-[12px] font-medium hover:bg-deep-violet disabled:opacity-50"
                >
                  {authLoading ? "인증 중..." : "인증 후 확인"}
                </button>
              </div>
            </div>
          )}

          {isAuthenticated && (
            <div className="space-y-3">
              {isChecking && (
                <p className="text-[12px] text-slate-500">유료 보고서 자격과 신청·결재 상태를 확인하는 중...</p>
              )}

              {eligibility && (
                <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[12px] font-medium text-slate-400">자격 요건</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${
                        eligibility.qualifies
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-amber-500/20 text-amber-200"
                      }`}
                    >
                      {eligibility.qualifies ? "충족" : "미충족"}
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-200">{eligibility.message}</p>
                  {!eligibility.qualifiesWeekly && (
                    <p className="text-[12px] text-slate-500 leading-relaxed">
                      각 주(일요일 기준)마다 서로 다른 날에 3일 이상 기록해야 합니다. 3일 미만인 주는 회색으로 표시됩니다.
                    </p>
                  )}
                  {eligibility.rolling && (
                    <p className="text-[12px] text-slate-500 leading-relaxed">
                      완화·테스트 기준: 최근 {eligibility.rolling.windowDays}일 동안 총{" "}
                      {eligibility.rolling.minRecords}회 이상 기록 시 신청 가능 (현재{" "}
                      {eligibility.rolling.recordCount}회
                      {eligibility.rolling.qualifies ? ", 충족" : ", 미충족"})
                    </p>
                  )}
                  {eligibility.weeklyDayCounts && eligibility.weeklyDayCounts.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-[12px] text-slate-400">
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

              <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 space-y-1">
                <p className="text-[12px] font-medium text-slate-400">유료 결재·진행 상태</p>
                {latestRequest ? (
                  <>
                    <p className="text-[12px] text-slate-200">신청: {statusLabel(latestRequest)}</p>
                    <p className="text-[12px] text-slate-300">결재: {paymentStatusLabel(latestRequest)}</p>
                    <p className="text-[12px] text-slate-400 leading-relaxed">{buildPaymentProgressGuide(latestRequest)}</p>
                    <p className="text-[12px] text-slate-500">
                      최근 업데이트: {new Date(latestRequest.updated_at).toLocaleString("ko-KR")}
                    </p>
                  </>
                ) : (
                  <p className="text-[12px] text-slate-400 leading-relaxed">
                    {buildPaymentProgressGuide(null, eligibility?.qualifies)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                {applyBlockReason && (
                  <p className="text-[12px] text-amber-200/90 leading-relaxed">{applyBlockReason}</p>
                )}
                {latestRequest && (latestRequest.status === "rejected" || latestRequest.status === "expired") && (
                  <p className="text-[12px] text-slate-500">
                    이전 신청이 {latestRequest.status === "rejected" ? "반려" : "만료"}되어 다시 신청할 수 있습니다.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!eligibility) {
                      void handleConfirmClick();
                      return;
                    }
                    if (!canSubmitNewRequest) return;
                    void submitRequest();
                  }}
                  disabled={requestBusy || (!!eligibility && !canSubmitNewRequest)}
                  className="w-full px-3 py-2 rounded-lg bg-deep-violet/80 text-white text-[12px] font-medium hover:bg-deep-violet disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {requestBusy
                    ? "신청 중..."
                    : !eligibility
                      ? "자격 확인 후 신청하기"
                      : latestRequest && (latestRequest.status === "rejected" || latestRequest.status === "expired")
                        ? "유료 보고서 다시 신청하기"
                        : "유료 보고서 신청하기"}
                </button>
              </div>

              {latestRequest?.status === "ready" && latestRequest.downloadable && (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="w-full px-3 py-2 rounded-lg bg-electric-blue/80 text-white text-[12px] font-medium hover:bg-electric-blue"
                >
                  나의 자깨 감응 보고서 다운로드
                </button>
              )}
            </div>
          )}

          {(authError || requestError) && (
            <p className="text-[12px] text-red-400">{authError || requestError}</p>
          )}
        </div>
      )}
    </div>
  );
}
