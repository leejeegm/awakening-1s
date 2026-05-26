/** 감응(Resonans) 유형별 본질 — UI·AI 참고용 */

export type ResonanceKindId =
  | "self"
  | "interpersonal"
  | "belonging"
  | "social"
  | "nature"
  | "life"
  | "other";

export type ResonanceEssenceItem = {
  id: ResonanceKindId;
  title: string;
  /** 한 줄 본질 */
  essence: string;
  /** 기록·실험과 연결되는 짧은 안내 */
  practice: string;
};

export const RESONANCE_ESSENCES: ResonanceEssenceItem[] = [
  {
    id: "self",
    title: "자신과의 감응",
    essence:
      "내면의 리듬·감정·의도가 한데 맞닿는 순간. 스스로를 듣고 인정할 때 일어나는, ‘나’ 안에서 울리는 고요한 공명.",
    practice: "1.00초 찰나에 ‘지금 내가 느끼는 것’을 있는 그대로 적을 때 가장 잘 드러납니다.",
  },
  {
    id: "interpersonal",
    title: "상대와의 감응",
    essence:
      "특정한 타인의 정서·말·침묵과 내 마음 사이의 맞물림. 이해·오해·그리움·감사 속에서 열리는 관계의 파동.",
    practice: "대화·갈등·추억이 떠오를 때, 상대 없이도 ‘관계 안의 나’를 기록해 볼 수 있습니다.",
  },
  {
    id: "belonging",
    title: "소속 감응",
    essence:
      "가족·팀·공동체 등 ‘우리’의 경계 안에서 느끼는 연대와 안식. 속함·소외·책임·자부심이 만들어 내는 정체성의 울림.",
    practice: "소속을 떠올리며 ‘여기서 내가 어떤 마음인지’를 짧게 남겨 보세요.",
  },
  {
    id: "social",
    title: "사회적 감응",
    essence:
      "사회·문화·시대·제도와의 간섭. 뉴스·규범·불안·희망이 개인 안에서 울리는 방식 — 나를 넘어선 흐름과의 공명.",
    practice: "세상 이슈·역할·시대감이 스친 찰나를, 판단 없이 감각으로 적어 보세요.",
  },
  {
    id: "nature",
    title: "자연과의 감응",
    essence:
      "산·바다·하늘·바람·계절 등 자연 리듬과 몸·마음의 동조. 인간 중심을 잠시 내려놓고 풍경·기후와 맞추는 고요한 일치.",
    practice: "야외·창밖·날씨·계절이 몸에 남긴 감각을 한 줄로 포착해 보세요.",
  },
  {
    id: "life",
    title: "생명체와의 감응",
    essence:
      "동식물·생명 전반과 나누는 돌봄·경이·연민. 살아 있음에 대한 경외, 함께 숨 쉰다는 감각의 파동.",
    practice: "반려·식물·들짐슬·생명 이야기가 마음에 닿은 순간을 기록해 보세요.",
  },
  {
    id: "other",
    title: "기타 다양한 감응",
    essence:
      "예술·음악·침묵·시간·신념·우연·꿈 등 범주 밖에서 울리는 감각. 이름 붙이기 어려운 울림도 충분히 감응입니다.",
    practice: "분류가 애매할수록 좋습니다. ‘이건 뭐라고 부를까’ 하고 느낌만 적어 보세요.",
  },
];

export const RESONANCE_ESSENCE_INTRO =
  "감응(Resonans)은 외부·내부 자극이 1.00초 안에 정서·의식·행동으로 드러나는 찰나의 공명입니다. 아래는 그 울림이 나뉘는 일곱 가지 본질의 안내입니다.";

export const RESONANCE_KIND_IDS = RESONANCE_ESSENCES.map((e) => e.id);

export function isResonanceKindId(v: string): v is ResonanceKindId {
  return (RESONANCE_KIND_IDS as string[]).includes(v);
}

export function resonanceKindLabel(id: string | null | undefined): string | null {
  if (!id || !isResonanceKindId(id)) return null;
  return RESONANCE_ESSENCES.find((e) => e.id === id)?.title ?? null;
}

/** 기록 모달 칩용 짧은 라벨 */
export function resonanceKindShortLabel(id: ResonanceKindId): string {
  const map: Record<ResonanceKindId, string> = {
    self: "자신",
    interpersonal: "상대",
    belonging: "소속",
    social: "사회",
    nature: "자연",
    life: "생명",
    other: "기타",
  };
  return map[id];
}
