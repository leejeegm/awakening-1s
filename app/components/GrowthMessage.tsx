"use client";

import { useCallback, useEffect, useRef, useMemo } from "react";
import { Volume2 } from "lucide-react";
import {
  PLAN_LABELS,
  PLAN_DAILY_LIMIT,
  PLAN_PERIOD_LIMIT,
  PLAN_PRICE,
  type PlanType,
} from "@/lib/planLimits";

const GROWTH_TEXT = "감응 시도가 누적될수록 감응하는 인간으로 성장중입니다.";

const WORD_COLORS = [
  "#2563EB", /* electric-blue */
  "#4C1D95", /* deep-violet */
  "#059669", /* emerald */
  "#D97706", /* amber */
  "#DB2777", /* pink */
  "#0891B2", /* cyan */
  "#7C3AED", /* violet */
  "#EA580C", /* orange */
];

function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

type Props = {
  planType: PlanType;
  usedToday?: number;
  usedPeriod?: number;
};

export default function GrowthMessage({ planType, usedToday = 0, usedPeriod }: Props) {
  const prevUsedTodayRef = useRef<number | undefined>(undefined);

  const speak = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(GROWTH_TEXT);
    u.lang = "ko-KR";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }, []);

  /* '오늘 N/10회' 횟수가 늘 때마다 음성 자동 재생 */
  useEffect(() => {
    if (prevUsedTodayRef.current !== undefined && usedToday > prevUsedTodayRef.current) {
      speak();
    }
    prevUsedTodayRef.current = usedToday;
  }, [usedToday, speak]);

  const wordsWithColors = useMemo(() => {
    const words = splitWords(GROWTH_TEXT);
    const shuffled = [...WORD_COLORS].sort(() => Math.random() - 0.5);
    return words.map((word, i) => ({
      word,
      color: shuffled[i % shuffled.length],
    }));
  }, []);

  const dailyLimit = PLAN_DAILY_LIMIT[planType];
  const periodLimit = PLAN_PERIOD_LIMIT[planType];
  const label = PLAN_LABELS[planType];
  const price = PLAN_PRICE[planType as keyof typeof PLAN_PRICE];

  return (
    <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 space-y-3">
      <p className="text-sm flex items-center gap-x-1.5 gap-y-1 flex-wrap">
        {wordsWithColors.map(({ word, color }, i) => (
          <span
            key={`${i}-${word}`}
            className="growth-word-wave inline-block"
            style={{
              color,
              animationDelay: `${i * 0.12}s`,
              textShadow: `0 0 1px ${color}40, 0 1px 2px rgba(0,0,0,0.3)`,
            }}
          >
            {word}
          </span>
        ))}
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
