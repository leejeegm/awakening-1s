"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { RESONANCE_ESSENCE_INTRO, RESONANCE_ESSENCES } from "@/lib/resonanceEssence";

export default function ResonanceEssenceSection() {
  const [openId, setOpenId] = useState<string | null>(RESONANCE_ESSENCES[0]?.id ?? null);

  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 overflow-hidden">
      <div className="p-4 border-b border-slate-700/60">
        <h2 className="text-sm font-medium text-slate-300">감응의 본질</h2>
        <p className="mt-2 text-xs text-slate-400 leading-relaxed">{RESONANCE_ESSENCE_INTRO}</p>
        <p className="mt-2 text-[11px] text-slate-500">
          「기록하기」에서 감응 유형(자신·상대·소속 등)을 선택해 남길 수 있습니다.
        </p>
      </div>

      <ul className="divide-y divide-slate-700/50">
        {RESONANCE_ESSENCES.map((item) => {
          const isOpen = openId === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : item.id)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-800/80 transition"
                aria-expanded={isOpen}
              >
                <span className="text-sm font-medium text-slate-200">{item.title}</span>
                <ChevronDown
                  className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && (
                <div className="px-4 pb-3 space-y-2">
                  <p className="text-xs text-electric-blue/90 font-medium">본질</p>
                  <p className="text-xs text-slate-300 leading-relaxed">{item.essence}</p>
                  <p className="text-xs text-deep-violet/90 font-medium pt-1">기록에 담기</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.practice}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
