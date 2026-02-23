"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/requestTimeout";

type ReactionRow = { created_at: string; reaction_type: string };

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i}시`);

function toKST(d: Date) {
  return new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

function aggregate(
  rows: ReactionRow[]
): { byHour: number[]; byDay: number[]; byWeek: Record<string, number>; byMonth: Record<string, number> } {
  const byHour = Array(24).fill(0);
  const byDay = Array(7).fill(0);
  const byWeek: Record<string, number> = {};
  const byMonth: Record<string, number> = {};

  for (const r of rows) {
    const utc = new Date(r.created_at);
    const kst = toKST(utc);
    const hour = kst.getHours();
    const day = kst.getDay();
    byHour[hour]++;
    byDay[day]++;

    const weekStart = new Date(kst);
    weekStart.setDate(kst.getDate() - kst.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekKey = weekStart.toISOString().slice(0, 10);
    byWeek[weekKey] = (byWeek[weekKey] ?? 0) + 1;

    const monthKey = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}`;
    byMonth[monthKey] = (byMonth[monthKey] ?? 0) + 1;
  }

  return { byHour, byDay, byWeek, byMonth };
}

const BAR_MAX_H = 44;

function BarBlock({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const h = max > 0 ? Math.max(3, (value / max) * BAR_MAX_H) : 3;
  return (
    <div className="flex flex-col items-center justify-end gap-1 min-w-0 flex-1 h-14">
      <div
        className="w-full rounded-t transition-all duration-300 shrink-0"
        style={{ height: `${h}px`, backgroundColor: color }}
      />
      <span className="text-[10px] text-slate-500 truncate w-full text-center leading-tight">{label}</span>
    </div>
  );
}

export default function ReactionCharts() {
  const [data, setData] = useState<ReactionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    withTimeout(
      supabase.from("reactions").select("created_at, reaction_type").order("created_at", { ascending: false }).limit(800)
    )
      .then(({ data: rows, error }) => {
        if (!error) setData((rows ?? []) as ReactionRow[]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 text-center text-slate-500 text-sm">
        감·응 통계 불러오는 중...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 text-center text-slate-500 text-sm">
        아직 감·응 데이터가 없습니다. 타인 기록에 감·응을 눌러 보세요.
      </div>
    );
  }

  const { byHour, byDay, byWeek, byMonth } = aggregate(data);
  const maxH = Math.max(1, ...byHour);
  const maxD = Math.max(1, ...byDay);
  const weekEntries = Object.entries(byWeek).sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
  const monthEntries = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  const maxW = Math.max(1, ...weekEntries.map(([, v]) => v));
  const maxMo = Math.max(1, ...monthEntries.map(([, v]) => v));

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-slate-400">감·응 선택 결과 시각화</h3>

      <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 space-y-4">
        <p className="text-xs text-slate-500">시간대별 (0~23시, KST)</p>
        <div className="flex gap-0.5">
          {byHour.map((v, i) => (
            <BarBlock
              key={i}
              label={i % 3 === 0 ? `${i}` : ""}
              value={v}
              max={maxH}
              color="rgba(37,99,235,0.7)"
            />
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 space-y-4">
        <p className="text-xs text-slate-500">요일별</p>
        <div className="flex gap-1">
          {byDay.map((v, i) => (
            <BarBlock key={i} label={DAY_NAMES[i]} value={v} max={maxD} color="rgba(76,29,149,0.7)" />
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 space-y-4">
        <p className="text-xs text-slate-500">주별 (최근 8주)</p>
        <div className="flex gap-1">
          {weekEntries.map(([k, v]) => (
            <BarBlock
              key={k}
              label={k.slice(5)}
              value={v}
              max={maxW}
              color="rgba(37,99,235,0.6)"
            />
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 space-y-4">
        <p className="text-xs text-slate-500">월별 (최근 6개월)</p>
        <div className="flex gap-2">
          {monthEntries.map(([k, v]) => (
            <BarBlock
              key={k}
              label={k.replace("-", "/")}
              value={v}
              max={maxMo}
              color="rgba(76,29,149,0.6)"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
