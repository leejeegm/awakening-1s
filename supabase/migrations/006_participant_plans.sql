-- 닉네임별 셀프 실험 설계자 플랜 (무료는 행 없음 = 10회/일)
-- plan_type: 'cho' 초°설계자 720회/월 7200원, 'bun' 분°설계자 1000회/월+이미지280 9900원, 'si' 시°설계자 1000회/년+이미지+멤버십 100만원
create table if not exists public.participant_plans (
  nickname text primary key,
  plan_type text not null check (plan_type in ('cho', 'bun', 'si')),
  valid_until timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.participant_plans enable row level security;

create policy "Allow public read plans"
  on public.participant_plans for select
  using (true);

comment on table public.participant_plans is '유료 플랜: 초°설계자 720회/월 7200원, 분°설계자 1000회/월 9900원, 시°설계자 1000회/년 100만원. 무료는 행 없음(10회/일).';
