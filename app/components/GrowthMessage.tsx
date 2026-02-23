"use client";

import { useCallback } from "react";
import { Volume2 } from "lucide-react";
import {
  PLAN_LABELS,
  PLAN_DAILY_LIMIT,
  PLAN_PERIOD_LIMIT,
  PLAN_PRICE,
  type PlanType,
} from "@/lib/planLimits";

const GROWTH_TEXT = "감응 시도가 누적될수록 감응하는 인간으로 성장중입니다.";

type Props = {
  planType: PlanType;
  usedToday?: number;
  usedPeriod?: number;
};

export default function GrowthMessage({ planType, usedToday = 0, usedPeriod }: Props) {
  const speak = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(GROWTH_TEXT);
    u.lang = "ko-KR";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }, []);

  const dailyLimit = PLAN_DAILY_LIMIT[planType];
  const periodLimit = PLAN_PERIOD_LIMIT[planType];
  const label = PLAN_LABELS[planType];
  const price = PLAN_PRICE[planType as keyof typeof PLAN_PRICE];

  return (
    <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 space-y-3">
      <p className="text-sm text-slate-300 flex items-center gap-2">
        <span>{GROWTH_TEXT}</span>
        <button
          type="button"
          onClick={speak}
          className="shrink-0 p-1.5 rounded-lg bg-slate-700/80 hover:bg-electric-blue/30 text-slate-400 hover:text-electric-blue transition"
          title="음성으로 듣기"
          aria-label="감응 동기부여 음성 재생"
        >
          <Volume2 className="w-4 h-4" />
        </button>
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>
          {label}
          {price != null && (
            <span className="ml-1 text-slate-500">({price})</span>
          )}
        </span>
        {planType === "free" && (
          <span>오늘 {usedToday}/{dailyLimit}회 (0시 기준 24시간)</span>
        )}
        {periodLimit && usedPeriod != null && (
          <span>
            {periodLimit.period === "month" ? "이번 달" : "이번 해"} {usedPeriod}/{periodLimit.count}회
          </span>
        )}
      </div>
    </div>
  );
}
