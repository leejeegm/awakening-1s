"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  RESONANCE_ESSENCE_INTRO,
  RESONANCE_ESSENCES,
  RESONANCE_NONE_ESSENCE,
} from "@/lib/resonanceEssence";

function CollapseToggle({
  expanded,
  onToggle,
  controlsId,
}: {
  expanded: boolean;
  onToggle: () => void;
  controlsId?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-expanded={expanded}
      aria-controls={controlsId}
      className="px-2.5 py-1 rounded-lg bg-slate-700/60 text-slate-300 text-xs hover:bg-slate-700 shrink-0 touch-manipulation min-h-[32px]"
    >
      {expanded ? "접기" : "펼치기"}
    </button>
  );
}

export default function ResonanceEssenceSection() {
  const [introExpanded, setIntroExpanded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 overflow-hidden">
      <div className="p-4 border-b border-slate-700/60">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-slate-300">감응의 본질</h2>
          <CollapseToggle
            expanded={introExpanded}
            onToggle={() => setIntroExpanded((v) => !v)}
            controlsId="resonance-essence-intro"
          />
        </div>
        {!introExpanded && (
          <p className="mt-2 text-[11px] text-slate-500">
            감응의 정의·기록 안내를 보려면 「펼치기」를 눌러 주세요.
          </p>
        )}
        {introExpanded && (
          <div id="resonance-essence-intro" className="mt-3 space-y-2">
            <p className="text-xs text-slate-400 leading-relaxed">{RESONANCE_ESSENCE_INTRO}</p>
            <p className="text-[11px] text-slate-500">
              「기록하기」에서 감응 유형(자신·상대·소속 등)을 고르거나, 「미선택」으로 유형을 열어 둔 채
              남길 수 있습니다. 미선택도 ‘지금은 분류하지 않겠다’는 의미 있는 선택입니다.
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              <span className="text-slate-400">{RESONANCE_NONE_ESSENCE.title} — </span>
              {RESONANCE_NONE_ESSENCE.essence}
            </p>
          </div>
        )}
      </div>

      <ul className="divide-y divide-slate-700/50">
        {RESONANCE_ESSENCES.map((item) => {
          const isOpen = openId === item.id;
          const panelId = `resonance-essence-${item.id}`;
          return (
            <li key={item.id}>
              <div className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-slate-800/80 transition">
                <span className="text-sm font-medium text-slate-200 flex-1 min-w-0">{item.title}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <CollapseToggle
                    expanded={isOpen}
                    onToggle={() => setOpenId(isOpen ? null : item.id)}
                    controlsId={panelId}
                  />
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                    className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 touch-manipulation"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    aria-label={isOpen ? `${item.title} 접기` : `${item.title} 펼치기`}
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
              </div>
              {isOpen && (
                <div id={panelId} className="px-4 pb-3 space-y-2 border-t border-slate-700/40 pt-3">
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
