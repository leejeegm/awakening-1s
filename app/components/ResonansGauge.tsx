"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/requestTimeout";

const CAP = 100;

function tokenize(text: string): string[] {
  return text
    .replace(/[\s.,!?;:'"()[\]{}\-\u3000-\u303f\uff00-\uffef]+/g, " ")
    .split(" ")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 2);
}

function topKeywords(notes: string[], n: number): string[] {
  const map = new Map<string, number>();
  for (const note of notes) {
    for (const word of tokenize(note)) {
      map.set(word, (map.get(word) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([w]) => w);
}

type Props = { myAttempts: number; lastRecordNickname?: string };

export default function ResonansGauge({ myAttempts, lastRecordNickname = "" }: Props) {
  const [total, setTotal] = useState(0);
  const [paused, setPaused] = useState(false);
  const [topWords, setTopWords] = useState<string[]>([]);
  const [visibleKeywords, setVisibleKeywords] = useState<string[]>([]);
  const [myRecordNotes, setMyRecordNotes] = useState<string[]>([]);
  const [showRandomNote, setShowRandomNote] = useState<string | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const fetchCount = async () => {
      try {
        const res = await withTimeout(
          Promise.resolve(client.from("awakenings").select("*", { count: "exact", head: true }))
        ) as { count: number | null; error: unknown };
        if (!res.error) setTotal(res.count ?? 0);
      } catch {}
    };
    fetchCount();
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const channel = client
      .channel("gauge")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "awakenings" },
        () => setTotal((prev) => prev + 1)
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, []);

  const fetchNotes = useCallback(async () => {
    const client = supabase;
    if (!client) return;
    try {
      const res = await withTimeout(
        Promise.resolve(client.from("awakenings").select("note").limit(80))
      ) as { data: { note: string }[] | null };
      const data = res.data;
      const notes = (data ?? []).map((r) => r.note);
      setTopWords(topKeywords(notes, 15));
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const channel = client
      .channel("gauge-notes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "awakenings" },
        () => { fetchNotes(); }
      )
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [fetchNotes]);

  useEffect(() => {
    const client = supabase;
    if (!client || !lastRecordNickname.trim()) {
      setMyRecordNotes([]);
      return;
    }
    const fetchMyNotes = async () => {
      try {
        const res = await withTimeout(
          Promise.resolve(
            client.from("awakenings").select("note").eq("nickname", lastRecordNickname.trim())
          )
        ) as { data: { note: string }[] | null };
        setMyRecordNotes((res.data ?? []).map((r) => r.note));
      } catch {
        setMyRecordNotes([]);
      }
    };
    fetchMyNotes();
  }, [lastRecordNickname]);

  useEffect(() => {
    if (topWords.length === 0) return;
    const pick = () => {
      const k = 5;
      const shuffled = [...topWords].sort(() => Math.random() - 0.5);
      setVisibleKeywords(shuffled.slice(0, k));
    };
    pick();
    const t = setInterval(pick, 3500);
    return () => clearInterval(t);
  }, [topWords]);

  const handleClick = useCallback(() => {
    if (paused) {
      setPaused(false);
      return;
    }
    if (myRecordNotes.length > 0 && !showRandomNote) {
      const random = myRecordNotes[Math.floor(Math.random() * myRecordNotes.length)];
      setShowRandomNote(random);
      setTimeout(() => setShowRandomNote(null), 4000);
      return;
    }
    setPaused(true);
  }, [paused, myRecordNotes, showRandomNote]);

  const pct = Math.min(100, (total / CAP) * 100);

  return (
    <div className="w-full">
      <div className="text-sm mb-1">
        <span className="text-slate-400">공명 게이지 (파동 바를 클릭해 보세요.)</span>
      </div>

      <button
        type="button"
        onClick={handleClick}
        className={`w-full flex flex-col rounded-xl overflow-hidden border border-slate-700/50 transition-all duration-300 ${paused ? "gauge-paused bg-slate-800/80" : "bg-slate-800/40"}`}
        style={{ minHeight: 200 }}
      >
        {/* 파동 + 키워드 영역 (상단, 남는 공간 전부) */}
        <div className="relative flex-1 min-h-[140px] flex flex-col">
          {/* 중심선 + 큰 진폭 파동선 (진폭 2배) */}
          {!paused && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
              <svg
                className="absolute w-full h-full min-h-[120px]"
                viewBox="0 0 300 200"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="gaugeWaveGrad" x1="0%" y1="0" x2="100%" y2="0">
                    <stop offset="0%" stopColor="rgba(37,99,235,0.25)" />
                    <stop offset="50%" stopColor="rgba(37,99,235,0.8)" />
                    <stop offset="100%" stopColor="rgba(76,29,149,0.8)" />
                  </linearGradient>
                </defs>
                {/* 중심선 — 박스 하단에서 2/5 위치 (y=120, 200의 3/5) */}
                <line x1="0" y1="120" x2="300" y2="120" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
                {/* 긴 파동 — 중심 120, 진폭 88 */}
                <path
                  className="gauge-wave-flow"
                  d="M0,120 Q25,32 50,120 T100,120 T150,120 T200,120 T250,120 T300,120"
                  fill="none"
                  stroke="url(#gaugeWaveGrad)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  style={{ animationDelay: "0s" }}
                />
                {/* 중간 파동 */}
                <path
                  className="gauge-wave-flow gauge-wave-mid"
                  d="M0,120 Q18,64 36,120 T72,120 T108,120 T144,120 T180,120 T216,120 T252,120 T300,120"
                  fill="none"
                  stroke="rgba(76,29,149,0.55)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  style={{ animationDelay: "0.4s" }}
                />
                {/* 작은 파동 */}
                <path
                  className="gauge-wave-flow gauge-wave-small"
                  d="M0,120 Q12,88 24,120 T48,120 T72,120 T96,120 T120,120 T144,120 T168,120 T192,120 T216,120 T240,120 T264,120 T288,120 T300,120"
                  fill="none"
                  stroke="rgba(37,99,235,0.65)"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  style={{ animationDelay: "0.8s" }}
                />
              </svg>
            </div>
          )}

          {/* 키워드 — 파동 위쪽에 배치 */}
          {!paused && visibleKeywords.length > 0 && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-2 left-0 right-0 h-[40%] flex items-center gauge-keyword-slide">
                <div className="flex gap-6 shrink-0 px-2">
                  {[...visibleKeywords, ...visibleKeywords].map((word, i) => (
                    <span
                      key={`${word}-${i}`}
                      className="gauge-keyword-flow inline-block px-2 py-0.5 rounded-md bg-slate-900/85 text-white font-semibold text-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                      style={{
                        textShadow: "0 0 1px rgba(37,99,235,0.9), 0 1px 2px rgba(0,0,0,0.5)",
                        animationDelay: `${(i % visibleKeywords.length) * 0.5}s`,
                      }}
                    >
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 클릭 시 내 기록 한 문장 랜덤 표시 */}
          {showRandomNote && (
            <div className="absolute inset-0 z-10 flex items-center justify-center p-3 bg-slate-900/95 rounded-xl">
              <p className="text-sm text-slate-200 text-center max-w-full line-clamp-3">
                &quot;{showRandomNote}&quot;
              </p>
            </div>
          )}

          {paused && !showRandomNote && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
            <p className="text-sm text-slate-300">
              <span className="text-electric-blue font-medium">내 누적 기록</span> {myAttempts}건
            </p>
            <p className="text-sm text-slate-300 mt-1">
              <span className="text-deep-violet font-medium">전체 참여자 누적</span> {total}건
            </p>
            <p className="text-xs text-slate-500 mt-2">다시 터치하면 파동이 이어집니다</p>
          </div>
          )}
        </div>

        {/* 진행 바 — 하단 고정 */}
        <div className="shrink-0 py-2 px-2">
          <div className="relative h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-deep-violet to-electric-blue transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </button>
    </div>
  );
}
