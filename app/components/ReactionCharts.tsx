"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/requestTimeout";

type ReactionRow = { created_at: string; reaction_type: string };

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function toKST(d: Date) {
  return new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

type BucketCount = { gam: number; eung: number };

function aggregate(rows: ReactionRow[]): {
  byHour: BucketCount[];
  byDay: BucketCount[];
  byWeek: Record<string, BucketCount>;
  byMonth: Record<string, BucketCount>;
} {
  const byHour: BucketCount[] = Array.from({ length: 24 }, () => ({ gam: 0, eung: 0 }));
  const byDay: BucketCount[] = Array.from({ length: 7 }, () => ({ gam: 0, eung: 0 }));
  const byWeek: Record<string, BucketCount> = {};
  const byMonth: Record<string, BucketCount> = {};

  for (const r of rows) {
    const utc = new Date(r.created_at);
    const kst = toKST(utc);
    const hour = kst.getHours();
    const day = kst.getDay();
    const isGam = r.reaction_type === "gam";

    byHour[hour][isGam ? "gam" : "eung"]++;
    byDay[day][isGam ? "gam" : "eung"]++;

    const weekStart = new Date(kst);
    weekStart.setDate(kst.getDate() - kst.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekKey = weekStart.toISOString().slice(0, 10);
    if (!byWeek[weekKey]) byWeek[weekKey] = { gam: 0, eung: 0 };
    byWeek[weekKey][isGam ? "gam" : "eung"]++;

    const monthKey = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[monthKey]) byMonth[monthKey] = { gam: 0, eung: 0 };
    byMonth[monthKey][isGam ? "gam" : "eung"]++;
  }

  return { byHour, byDay, byWeek, byMonth };
}

const BAR_MAX_H = 40;

function BarBlockWithTooltip({
  label,
  gam,
  eung,
  maxTotal,
  colorGam,
  colorEung,
}: {
  label: string;
  gam: number;
  eung: number;
  maxTotal: number;
  colorGam: string;
  colorEung: string;
}) {
  const total = gam + eung;
  const hTotal = maxTotal > 0 ? Math.max(3, (total / maxTotal) * BAR_MAX_H) : 3;
  const hGam = total > 0 ? (gam / total) * hTotal : 0;
  const hEung = total > 0 ? (eung / total) * hTotal : 0;
  const [popup, setPopup] = useState(false);

  return (
    <div
      className="flex flex-col items-center justify-end gap-1 min-w-0 flex-1 h-14 relative touch-manipulation"
      onMouseEnter={() => setPopup(true)}
      onMouseLeave={() => setPopup(false)}
      onFocus={() => setPopup(true)}
      onBlur={() => setPopup(false)}
      onTouchStart={() => setPopup((p) => !p)}
    >
      <div className="w-full flex flex-col-reverse rounded-t overflow-hidden shrink-0" style={{ height: `${hTotal}px` }}>
        {hEung > 0 && <div className="w-full min-h-[1px]" style={{ height: `${hEung}px`, backgroundColor: colorEung }} />}
        {hGam > 0 && <div className="w-full min-h-[1px]" style={{ height: `${hGam}px`, backgroundColor: colorGam }} />}
      </div>
      <span className="text-[10px] text-slate-500 truncate w-full text-center leading-tight">{label}</span>
      {popup && (gam > 0 || eung > 0) && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1.5 rounded bg-slate-900 border border-slate-600 text-xs text-slate-200 whitespace-nowrap z-20 shadow-xl">
          <div className="font-medium text-slate-400 mb-0.5">{label}</div>
          <div>감 {gam}건 · 응 {eung}건 (빈도순: {gam >= eung ? "감 → 응" : "응 → 감"})</div>
        </div>
      )}
    </div>
  );
}

export default function ReactionCharts() {
  const [data, setData] = useState<ReactionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }
    withTimeout(
      Promise.resolve(
        client.from("reactions").select("created_at, reaction_type").order("created_at", { ascending: false }).limit(800)
      )
    )
      .then((res: { data: ReactionRow[] | null; error: unknown }) => {
        if (!res.error) setData((res.data ?? []) as ReactionRow[]);
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
  const total = (b: { gam: number; eung: number }) => b.gam + b.eung;
  const maxH = Math.max(1, ...byHour.map(total));
  const maxD = Math.max(1, ...byDay.map(total));
  const weekEntries = Object.entries(byWeek).sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
  const monthEntries = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  const maxW = Math.max(1, ...weekEntries.map(([, v]) => total(v)));
  const maxMo = Math.max(1, ...monthEntries.map(([, v]) => total(v)));

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-slate-400">감·응 선택 결과 시각화</h3>
      <p className="text-[10px] text-slate-500">막대에 마우스/터치 시 감·응 건수 팝업 (감=긍정, 응=구독)</p>

      <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 space-y-4">
        <p className="text-xs text-slate-500">시간대별 (0~23시, KST) — 아래 감, 위 응</p>
        <div className="flex gap-0.5">
          {byHour.map((v, i) => (
            <BarBlockWithTooltip
              key={i}
              label={i % 3 === 0 ? `${i}시` : ""}
              gam={v.gam}
              eung={v.eung}
              maxTotal={maxH}
              colorGam="rgba(37,99,235,0.8)"
              colorEung="rgba(76,29,149,0.8)"
            />
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 space-y-4">
        <p className="text-xs text-slate-500">요일별</p>
        <div className="flex gap-1">
          {byDay.map((v, i) => (
            <BarBlockWithTooltip
              key={i}
              label={DAY_NAMES[i]}
              gam={v.gam}
              eung={v.eung}
              maxTotal={maxD}
              colorGam="rgba(37,99,235,0.8)"
              colorEung="rgba(76,29,149,0.8)"
            />
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 space-y-4">
        <p className="text-xs text-slate-500">주별 (최근 8주)</p>
        <div className="flex gap-1">
          {weekEntries.map(([k, v]) => (
            <BarBlockWithTooltip
              key={k}
              label={k.slice(5)}
              gam={v.gam}
              eung={v.eung}
              maxTotal={maxW}
              colorGam="rgba(37,99,235,0.7)"
              colorEung="rgba(76,29,149,0.7)"
            />
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 space-y-4">
        <p className="text-xs text-slate-500">월별 (최근 6개월)</p>
        <div className="flex gap-2">
          {monthEntries.map(([k, v]) => (
            <BarBlockWithTooltip
              key={k}
              label={k.replace("-", "/")}
              gam={v.gam}
              eung={v.eung}
              maxTotal={maxMo}
              colorGam="rgba(37,99,235,0.7)"
              colorEung="rgba(76,29,149,0.7)"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
