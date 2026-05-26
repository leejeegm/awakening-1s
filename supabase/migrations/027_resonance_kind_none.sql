-- 미선택(none)을 명시적 감응 값으로 통일 (NULL·과거 행 백필)
update public.awakenings
set resonance_kind = 'none'
where resonance_kind is null;

alter table public.awakenings
  alter column resonance_kind set default 'none';

comment on column public.awakenings.resonance_kind is
  '감응 유형: none(미선택·의도적 열림)|self|interpersonal|belonging|social|nature|life|other';
