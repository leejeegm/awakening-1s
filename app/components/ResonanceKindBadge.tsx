"use client";

import {
  isResonanceKindId,
  normalizeResonanceKindFromDb,
  RESONANCE_KIND_NONE,
  resonanceKindShortLabel,
} from "@/lib/resonanceEssence";

type Props = {
  resonanceKind?: string | null;
  resonanceKindAi?: string | null;
  className?: string;
};

/** 사용자 유형·미선택·AI 추천 뱃지 */
export default function ResonanceKindBadge({
  resonanceKind,
  resonanceKindAi,
  className = "",
}: Props) {
  const userKind = normalizeResonanceKindFromDb(resonanceKind);
  const aiKind = resonanceKindAi && isResonanceKindId(resonanceKindAi) ? resonanceKindAi : null;

  if (userKind !== RESONANCE_KIND_NONE && isResonanceKindId(userKind)) {
    return (
      <span
        className={`inline-flex text-[10px] px-1.5 py-0.5 rounded-full bg-electric-blue/15 text-electric-blue border border-electric-blue/30 ${className}`}
      >
        {resonanceKindShortLabel(userKind)}
      </span>
    );
  }

  if (aiKind) {
    return (
      <span
        className={`inline-flex text-[10px] px-1.5 py-0.5 rounded-full bg-deep-violet/20 text-deep-violet border border-deep-violet/35 ${className}`}
      >
        AI 추천 · {resonanceKindShortLabel(aiKind)}
      </span>
    );
  }

  if (userKind === RESONANCE_KIND_NONE) {
    return (
      <span
        className={`inline-flex text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700/50 text-slate-500 border border-slate-600/50 ${className}`}
      >
        미선택
      </span>
    );
  }

  return null;
}
