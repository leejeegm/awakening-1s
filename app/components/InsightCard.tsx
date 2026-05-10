"use client";

import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import SpeechControls from "@/app/components/SpeechControls";

type Props = {
  lastRecordNickname?: string;
};

export default function InsightCard({ lastRecordNickname = "" }: Props) {
  const [card, setCard] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [source, setSource] = useState<"openai" | "gemini" | "rule" | null>(null);

  useEffect(() => {
    setCard(null);
    setError(false);
    setSource(null);
    setLoading(true);
    const q = lastRecordNickname
      ? `?nickname=${encodeURIComponent(lastRecordNickname)}`
      : "";
    fetch(`/api/ai/insight${q}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.card) {
          setCard(data.card);
          setSource(
            data.source === "rule" ? "rule" : data.source === "gemini" ? "gemini" : "openai"
          );
        }
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [lastRecordNickname]);

  if (loading) {
    return (
      <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 flex items-center gap-3 text-slate-500">
        <Sparkles className="w-5 h-5 animate-pulse" />
        <span className="text-sm">감응 인사이트 분석 중...</span>
      </div>
    );
  }

  if (error || !card) {
    return null;
  }

  return (
    <div className="rounded-xl bg-gradient-to-br from-slate-800/80 to-deep-violet/10 border border-slate-700/50 p-4">
      <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1">
        <Sparkles className="w-3.5 h-3.5" />
        {lastRecordNickname ? "맞춤 감응 카드" : "이번 감응 트렌드"}
        {source === "rule" && (
          <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-400/30">
            일시적 문제로 룰베이스 제공
          </span>
        )}
        {source === "gemini" && (
          <span className="ml-1 px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-200 border border-sky-400/25">
            Gemini 요약 (1차)
          </span>
        )}
      </p>
      <p className="text-sm text-slate-200 leading-relaxed">{card}</p>
      <div className="mt-2">
        <SpeechControls text={card} speakLabel="말하기" stopLabel="멈춤" />
      </div>
    </div>
  );
}
