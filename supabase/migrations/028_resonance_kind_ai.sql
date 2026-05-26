-- 미선택(none) 기록에 대한 AI 추천 감응 유형 (사용자 선택과 분리)
alter table public.awakenings
  add column if not exists resonance_kind_ai text;

comment on column public.awakenings.resonance_kind_ai is
  'AI 추천 감응 유형: self|interpersonal|... (resonance_kind=none 일 때만 의미)';

create index if not exists idx_awakenings_resonance_kind_ai on public.awakenings(resonance_kind_ai)
  where resonance_kind_ai is not null;
