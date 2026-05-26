-- 기록별 감응 유형(자신·상대·소속·사회·자연·생명·기타)
alter table public.awakenings
  add column if not exists resonance_kind text;

comment on column public.awakenings.resonance_kind is
  '감응 유형: none(미선택)|self|interpersonal|belonging|social|nature|life|other — 027에서 none 기본·백필';

create index if not exists idx_awakenings_resonance_kind on public.awakenings(resonance_kind)
  where resonance_kind is not null;
