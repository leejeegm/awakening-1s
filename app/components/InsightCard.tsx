"use client";

import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import SpeechControls from "@/app/components/SpeechControls";
import { sanitizeAiUserText } from "@/lib/aiUserText";

type Props = {
  lastRecordNickname?: string;
  participantAuthHash?: string;
};

export default function InsightCard({ lastRecordNickname = "", participantAuthHash = "" }: Props) {
  const [card, setCard] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setCard(null);
    setError(false);
    setLoading(true);
    const nick = lastRecordNickname.trim();
  const hash = participantAuthHash.trim();
  if (nick && !hash) {
    setCard(null);
    setError(false);
    setLoading(false);
    return;
  }
    const params = new URLSearchParams();
    if (nick) {
      params.set("nickname", nick);
      params.set("authHash", hash);
    }
    fetch(`/api/ai/insight?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.card) {
          setCard(sanitizeAiUserText(String(data.card)));
        } else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [lastRecordNickname, participantAuthHash]);

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
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
        <div>
          <p className="text-[12px] text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            {lastRecordNickname ? "맞춤 감응 카드" : "이번 감응 트렌드"}
          </p>
          <p className="text-[11px] text-slate-600 mt-0.5">
            {lastRecordNickname
              ? "쌓인 기록의 흐름·통찰 (따뜻한 한마디와 다른 톤)"
              : "참여자 기록의 공통 감응 흐름"}
          </p>
        </div>
        <SpeechControls text={card} speakLabel="말하기" stopLabel="멈춤" />
      </div>
      <p className="text-[12px] text-slate-200 leading-relaxed">{card}</p>
    </div>
  );
}
