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
    if (!supabase) return;
    const fetchCount = async () => {
      try {
        const { count, error } = await withTimeout(
          supabase.from("awakenings").select("*", { count: "exact", head: true })
        );
        if (!error) setTotal(count ?? 0);
      } catch {}
    };
    fetchCount();
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("gauge")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "awakenings" },
        () => setTotal((prev) => prev + 1)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotes = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data } = await withTimeout(supabase.from("awakenings").select("note").limit(80));
      const notes = (data ?? []).map((r) => (r as { note: string }).note);
      setTopWords(topKeywords(notes, 15));
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("gauge-notes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "awakenings" },
        () => { fetchNotes(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchNotes]);

  useEffect(() => {
    if (!supabase || !lastRecordNickname.trim()) {
      setMyRecordNotes([]);
      return;
    }
    const fetchMyNotes = async () => {
      try {
        const { data } = await withTimeout(
          supabase.from("awakenings").select("note").eq("nickname", lastRecordNickname.trim())
        );
        setMyRecordNotes((data ?? []).map((r) => (r as { note: string }).note));
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
        className={`w-full relative rounded-xl overflow-hidden border border-slate-700/50 transition-all duration-300 ${paused ? "gauge-paused bg-slate-800/80" : "bg-slate-800/40"}`}
        style={{ minHeight: 160 }}
      >
        {/* 중심선 + 큰 진폭 파동선 중첩 */}
        {!paused && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
            <svg
              className="absolute w-full h-28"
              viewBox="0 0 300 112"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="gaugeWaveGrad" x1="0%" y1="0" x2="100%" y2="0">
                  <stop offset="0%" stopColor="rgba(37,99,235,0.25)" />
                  <stop offset="50%" stopColor="rgba(37,99,235,0.8)" />
                  <stop offset="100%" stopColor="rgba(76,29,149,0.8)" />
                </linearGradient>
              </defs>
              {/* 중심선 */}
              <line x1="0" y1="56" x2="300" y2="56" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
              {/* 긴 파동 (진폭 큼) */}
              <path
                className="gauge-wave-flow"
                d="M0,56 Q25,12 50,56 T100,56 T150,56 T200,56 T250,56 T300,56"
                fill="none"
                stroke="url(#gaugeWaveGrad)"
                strokeWidth="2"
                strokeLinecap="round"
                style={{ animationDelay: "0s" }}
              />
              {/* 중간 파동 */}
              <path
                className="gauge-wave-flow gauge-wave-mid"
                d="M0,56 Q18,28 36,56 T72,56 T108,56 T144,56 T180,56 T216,56 T252,56 T300,56"
                fill="none"
                stroke="rgba(76,29,149,0.55)"
                strokeWidth="1.6"
                strokeLinecap="round"
                style={{ animationDelay: "0.4s" }}
              />
              {/* 작은 파동 */}
              <path
                className="gauge-wave-flow gauge-wave-small"
                d="M0,56 Q12,40 24,56 T48,56 T72,56 T96,56 T120,56 T144,56 T168,56 T192,56 T216,56 T240,56 T264,56 T288,56 T300,56"
                fill="none"
                stroke="rgba(37,99,235,0.65)"
                strokeWidth="1.2"
                strokeLinecap="round"
                style={{ animationDelay: "0.8s" }}
              />
            </svg>
          </div>
        )}

        {/* 키워드가 파동선을 타고 흐르는 듯한 표시 */}
        {!paused && visibleKeywords.length > 0 && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden pb-10">
            <div className="absolute inset-0 flex items-center gauge-keyword-slide">
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
              "{showRandomNote}"
            </p>
          </div>
        )}

        {/* 진행 바 */}
        <div className="relative h-2 mt-2 mx-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-deep-violet to-electric-blue transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

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
      </button>
    </div>
  );
}
