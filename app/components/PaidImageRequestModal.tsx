"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Check, Send } from "lucide-react";

type FeatureKey = "image_cut" | "comic_4panel";

type PendingRequest = {
  id: string;
  feature_key: FeatureKey;
  status: string;
  payment_status: "unpaid" | "paid" | "waived";
  requested_at: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  nickname: string;
  sharedNickname?: string | null;
  authHash: string;
  onStartGenerate?: () => void;
};

type AccessResponse = {
  ok?: boolean;
  error?: string;
  requiresAuth?: boolean;
  features?: Record<FeatureKey, boolean>;
  pendingRequests?: PendingRequest[];
};

const FEATURE_LABELS: Record<FeatureKey, string> = {
  image_cut: "한 장 컷",
  comic_4panel: "4면 웹툰",
};

function paymentLabel(s: PendingRequest["payment_status"]) {
  if (s === "paid") return "결제 확인됨";
  if (s === "waived") return "결제 면제";
  return "결제 확인 대기";
}

function FeatureRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2">
      <span className="text-[13px] text-slate-300">{label}</span>
      {enabled ? (
        <span className="text-[12px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          승인됨
        </span>
      ) : (
        <span className="text-[12px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-200 border border-amber-500/25">
          승인 대기
        </span>
      )}
    </div>
  );
}

export default function PaidImageRequestModal({
  open,
  onClose,
  nickname,
  sharedNickname = null,
  authHash,
  onStartGenerate,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<AccessResponse | null>(null);
  const [requestMsg, setRequestMsg] = useState<string | null>(null);
  const [requestErr, setRequestErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [wantCut, setWantCut] = useState(true);
  const [wantComic, setWantComic] = useState(true);

  const reload = useCallback(async () => {
    const n = (nickname ?? "").trim();
    const h = (authHash ?? "").trim();
    if (!n || !h) return;
    setLoading(true);
    setRequestErr(null);
    try {
      const res = await fetch(
        `/api/image/server-access?nickname=${encodeURIComponent(n)}&authHash=${encodeURIComponent(h)}`
      );
      const j = (await res.json().catch(() => ({}))) as AccessResponse;
      setData(j);
    } finally {
      setLoading(false);
    }
  }, [nickname, authHash]);

  useEffect(() => {
    if (!open) return;
    setData(null);
    setRequestMsg(null);
    setRequestErr(null);
    setCopied(false);
    void reload();
  }, [open, reload]);

  const submitRequest = async () => {
    const n = (nickname ?? "").trim();
    const h = (authHash ?? "").trim();
    if (!n || !h) return;
    const featureKeys: FeatureKey[] = [];
    if (wantCut) featureKeys.push("image_cut");
    if (wantComic) featureKeys.push("comic_4panel");
    if (featureKeys.length === 0) {
      setRequestErr("요청할 기능을 하나 이상 선택해 주세요.");
      return;
    }
    setSubmitting(true);
    setRequestErr(null);
    setRequestMsg(null);
    try {
      const res = await fetch("/api/image/entitlement-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: n, authHash: h, featureKeys }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok || !json.ok) {
        setRequestErr(json.error ?? "요청 접수에 실패했습니다.");
        return;
      }
      setRequestMsg(json.message ?? "승인 요청이 접수되었습니다.");
      await reload();
    } catch {
      setRequestErr("네트워크 오류");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const n = (nickname ?? "").trim();
  const h = (authHash ?? "").trim();
  const shared = (sharedNickname ?? "").trim();
  const features = data?.features ?? { image_cut: false, comic_4panel: false };
  const pending = data?.pendingRequests ?? [];
  const anyApproved = !!features.image_cut || !!features.comic_4panel;
  const pendingCut = pending.some((p) => p.feature_key === "image_cut");
  const pendingComic = pending.some((p) => p.feature_key === "comic_4panel");

  const copyNickname = async () => {
    if (!n) return;
    try {
      await navigator.clipboard.writeText(n);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-[min(96vw,32rem)] max-h-[90vh] overflow-hidden rounded-xl bg-slate-800 border border-slate-600 shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-slate-600">
          <h3 className="text-[13px] font-medium text-slate-200">유료 이미지 생성 신청</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1" aria-label="닫기">
            ×
          </button>
        </div>

        <div className="p-3 overflow-y-auto space-y-3">
          {!n || !h ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[13px] text-amber-100 leading-relaxed">
              먼저 「자각 기록 보기(닉네임 비번 설정)」에서 <strong className="font-medium">개인 닉네임</strong>·비밀번호로 조회(인증)해 주세요.
            </div>
          ) : loading ? (
            <p className="text-sm text-slate-500">승인 여부 확인 중…</p>
          ) : data?.requiresAuth ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[13px] text-amber-100">
              세션이 만료되었을 수 있습니다. 다시 「자각 기록 보기」에서 조회해 주세요.
            </div>
          ) : data?.ok === false ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-[13px] text-red-200">
              {data.error ?? "승인 상태를 확인할 수 없습니다."}
            </div>
          ) : (
            <>
              <p className="text-[13px] text-slate-400 leading-relaxed">
                서버 이미지 생성은 <strong className="text-slate-300 font-normal">개인 닉네임</strong>별 승인·결제 확인 후 사용합니다.
                {shared ? (
                  <span className="block mt-1 text-slate-500">
                    공동 닉네임({shared})과 별도입니다.
                  </span>
                ) : null}
              </p>

              <div className="flex items-center gap-2 rounded-lg bg-slate-950/50 border border-slate-700 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-slate-500">승인 요청 닉네임 (개인)</div>
                  <div className="font-mono text-[13px] text-violet-100 truncate">{n}</div>
                </div>
                <button
                  type="button"
                  onClick={copyNickname}
                  className="shrink-0 inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-slate-700 text-slate-200 text-[12px] hover:bg-slate-600"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "복사됨" : "복사"}
                </button>
              </div>

              <div className="space-y-2">
                <FeatureRow label="한 장 컷 (image_cut)" enabled={!!features.image_cut} />
                <FeatureRow label="4면 웹툰 (comic_4panel)" enabled={!!features.comic_4panel} />
              </div>

              {pending.length > 0 && (
                <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 text-[12px] text-violet-100 space-y-1">
                  <div className="font-medium text-[13px]">접수된 승인 요청</div>
                  {pending.map((p) => (
                    <div key={p.id} className="flex flex-wrap gap-x-2 text-slate-300">
                      <span>{FEATURE_LABELS[p.feature_key]}</span>
                      <span className="text-slate-500">
                        {new Date(p.requested_at).toLocaleString("ko-KR")}
                      </span>
                      <span className="text-amber-200/90">{paymentLabel(p.payment_status)}</span>
                    </div>
                  ))}
                </div>
              )}

              {!anyApproved && (
                <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-3 space-y-3">
                  <div className="text-[13px] text-slate-300 font-medium">승인 요청</div>
                  <p className="text-[12px] text-slate-500 leading-relaxed">
                    요청하면 관리자 화면에 닉네임·요청 일시·결제 상태가 표시됩니다. 결제 확인 후 관리자가 승인하면 반영됩니다.
                  </p>
                  <div className="flex flex-wrap gap-3 text-[13px]">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={wantCut}
                        onChange={(e) => setWantCut(e.target.checked)}
                        disabled={!!features.image_cut || pendingCut}
                        className="rounded border-slate-600"
                      />
                      한 장 컷
                      {pendingCut && <span className="text-[11px] text-violet-300">(접수됨)</span>}
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={wantComic}
                        onChange={(e) => setWantComic(e.target.checked)}
                        disabled={!!features.comic_4panel || pendingComic}
                        className="rounded border-slate-600"
                      />
                      4면 웹툰
                      {pendingComic && <span className="text-[11px] text-violet-300">(접수됨)</span>}
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={submitRequest}
                    disabled={submitting}
                    className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-electric-blue/80 hover:bg-electric-blue text-white font-semibold text-[13px] disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {submitting ? "접수 중…" : "승인 요청 보내기"}
                  </button>
                  {requestMsg && <p className="text-[12px] text-emerald-300">{requestMsg}</p>}
                  {requestErr && <p className="text-[12px] text-red-400">{requestErr}</p>}
                </div>
              )}

              {anyApproved && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onStartGenerate?.();
                  }}
                  className="w-full min-h-[44px] py-2.5 rounded-lg bg-deep-violet/80 hover:bg-deep-violet text-white font-semibold text-[13px]"
                >
                  승인됨 · 이미지 생성하러 가기
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
