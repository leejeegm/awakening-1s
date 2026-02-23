"use client";

import { useState, useCallback } from "react";
import Image from "next/image";

const DURATION_MS = 1000;

function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-12 h-12 text-white"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="4" y1="4" x2="20" y2="20" />
      <line x1="20" y1="4" x2="4" y2="20" />
    </svg>
  );
}

export default function AwakeningButton({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [waves, setWaves] = useState<{ id: number }[]>([]);
  const [waveId, setWaveId] = useState(0);
  const [imgError, setImgError] = useState(false);

  const runTimer = useCallback(() => {
    if (running) return;
    setRunning(true);
    setElapsed(0);
    setWaves((w) => [...w, { id: waveId }]);
    setWaveId((id) => id + 1);

    const start = Date.now();
    const interval = setInterval(() => {
      const e = Math.min(DURATION_MS, Date.now() - start);
      setElapsed(e);
      if (e >= DURATION_MS) {
        clearInterval(interval);
        setRunning(false);
        onComplete();
      }
    }, 16);
  }, [running, waveId, onComplete]);

  return (
    <div className="relative flex flex-col items-center justify-center py-8">
      {/* 감응 파동 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        {waves.map((w) => (
          <div
            key={w.id}
            className="ring-wave border-electric-blue/60"
            style={{
              width: 120,
              height: 120,
              marginLeft: -60,
              marginTop: -60,
            }}
            onAnimationEnd={() =>
              setWaves((prev) => prev.filter((x) => x.id !== w.id))
            }
          />
        ))}
      </div>

      {/* 1.00s° 타이머 */}
      <div className="relative z-10 text-center">
        {running ? (
          <div className="timer-display text-5xl font-bold bg-gradient-resonans bg-clip-text text-transparent">
            {(elapsed / 1000).toFixed(2)}s°
          </div>
        ) : (
          <div className="timer-display text-2xl text-slate-400">1.00s°</div>
        )}

        {/* 감응 시도 버튼 — 제공 이미지(X) + 호버 툴팁 */}
        <button
          type="button"
          onClick={runTimer}
          disabled={running}
          title="자신을 깨우는 1.00초° 순간을 기록하세요"
          className="mt-6 w-24 h-24 rounded-xl overflow-hidden flex items-center justify-center shadow-lg shadow-electric-blue/20 hover:shadow-electric-blue/40 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95 group bg-slate-900/80 border border-slate-600"
          aria-label="감응 시도"
        >
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 border border-slate-600 z-20">
            자신을 깨우는 1.00초° 순간을 기록하세요
          </span>
          {imgError ? (
            <XIcon />
          ) : (
            <Image
              src="/resonance-x.jpg"
              alt="감응 시도"
              width={96}
              height={96}
              className="w-full h-full object-contain"
              unoptimized
              onError={() => setImgError(true)}
            />
          )}
        </button>
        <p className="mt-2 text-sm text-slate-400">감응 시도</p>
      </div>
    </div>
  );
}
