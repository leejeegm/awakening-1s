-- 한시적 실험 운영: 참여자 중 한 명이 '실험 종료' 선택 시 감응실험실을 숨기기 위한 플래그
create table if not exists public.experiment_control (
  id int primary key default 1 check (id = 1),
  ended boolean not null default false,
  ended_at timestamptz,
  ended_by text,
  updated_at timestamptz not null default now()
);

alter table public.experiment_control enable row level security;

drop policy if exists "Allow public read experiment_control" on public.experiment_control;
create policy "Allow public read experiment_control"
  on public.experiment_control for select using (true);

-- 업데이트는 서비스 역할(API)에서만 수행
drop policy if exists "Allow service update experiment_control" on public.experiment_control;
create policy "Allow service update experiment_control"
  on public.experiment_control for update using (true) with check (true);

insert into public.experiment_control (id, ended) values (1, false)
on conflict (id) do nothing;

comment on table public.experiment_control is '한시적 실험 운영. ended=true 시 앱에서 실험실 UI 숨김.';