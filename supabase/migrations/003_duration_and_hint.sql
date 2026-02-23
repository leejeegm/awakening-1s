-- 자각 기록에 찰나 유형 추가 (1초/10초/100초)
alter table public.awakenings
  add column if not exists duration_type text not null default '1s';

-- 비밀번호 힌트 (찾기용, 선택 입력)
alter table public.participant_keys
  add column if not exists password_hint text;
