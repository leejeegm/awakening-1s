"use client";

import { useEffect, useState } from "react";

type FeatureKey = "image_cut" | "comic_4panel";

type Props = {
  open: boolean;
  onClose: () => void;
  nickname: string;
  authHash: string;
  onStartGenerate?: () => void;
};

type AccessResponse = {
  ok?: boolean;
  error?: string;
  requiresAuth?: boolean;
  features?: Record<FeatureKey, boolean>;
  usage?: unknown;
  usageError?: unknown;
};

function FeatureRow({
  label,
  enabled,
}: {
  label: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2">
      <span className="text-[12px] text-slate-300">{label}</span>
      {enabled ? (
        <span className="text-[11px] text-emerald-200">
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            승인됨(1회)
          </span>
          <span className="ml-2 text-slate-500">- 오류시 재승인 요청</span>
        </span>
      ) : (
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-200 border border-amber-500/25">
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
  authHash,
  onStartGenerate,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AccessResponse | null>(null);

  useEffect(() => {
    if (!open) return;
    setData(null);
    const n = (nickname ?? "").trim();
    const h = (authHash ?? "").trim();
    if (!n || !h) return;
    setLoading(true);
    fetch(`/api/image/server-access?nickname=${encodeURIComponent(n)}&authHash=${encodeURIComponent(h)}`)
      .then((r) => r.json().catch(() => ({})))
      .then((j) => setData(j as AccessResponse))
      .finally(() => setLoading(false));
  }, [open, nickname, authHash]);

  if (!open) return null;

  const n = (nickname ?? "").trim();
  const h = (authHash ?? "").trim();
  const features = data?.features ?? { image_cut: false, comic_4panel: false };
  const anyApproved = !!features.image_cut || !!features.comic_4panel;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="w-[min(96vw,30rem)] max-h-[90vh] overflow-hidden rounded-xl bg-slate-800 border border-slate-600 shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-slate-600">
          <h3 className="text-[12px] font-medium text-slate-200">유료 이미지 생성 신청</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1" aria-label="닫기">
            ×
          </button>
        </div>

        <div className="p-3 overflow-y-auto space-y-3">
          {!n || !h ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] text-amber-100">
              먼저 「자각 기록 보기(닉네임 비번 설정)」에서 닉네임·비밀번호로 조회(인증)해 주세요.
            </div>
          ) : loading ? (
            <p className="text-sm text-slate-500">승인 여부 확인 중…</p>
          ) : data?.requiresAuth ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] text-amber-100">
              세션이 만료되었을 수 있습니다. 다시 「자각 기록 보기」에서 조회해 주세요.
            </div>
          ) : data?.ok === false ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-[12px] text-red-200">
              {data.error ?? "승인 상태를 확인할 수 없습니다."}
            </div>
          ) : (
            <>
              <p className="text-[12px] text-slate-400">
                서버 이미지 생성은 비용이 발생하므로 닉네임별로 관리자 승인 후 사용 가능합니다.
              </p>

              <div className="space-y-2">
                <FeatureRow label="한 장 컷(image_cut)" enabled={!!features.image_cut} />
                <FeatureRow label="4면 웹툰(comic_4panel)" enabled={!!features.comic_4panel} />
              </div>

              {!anyApproved ? (
                <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-3 text-[12px] text-slate-300 space-y-1">
                  <div className="text-slate-400 font-medium">승인 요청 방법</div>
                  <div className="text-slate-500">
                    관리자에게 아래 닉네임으로 기능 승인을 요청해 주세요.
                  </div>
                  <div className="mt-2 rounded bg-slate-950/50 border border-slate-700 px-3 py-2 font-mono text-[12px] text-slate-200">
                    nickname: {n}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onStartGenerate?.();
                  }}
                  className="w-full min-h-[44px] py-2.5 rounded-lg bg-deep-violet/80 hover:bg-deep-violet text-white font-semibold text-[12px]"
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

