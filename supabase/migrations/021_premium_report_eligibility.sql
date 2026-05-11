-- 매주 3일 이상 4주 연속 자격 계산 캐시

create table if not exists public.premium_report_eligibility_snapshots (
  nickname text primary key,
  qualifies boolean not null default false,
  consecutive_weeks integer not null default 0,
  qualifies_from_week date null,
  evaluated_at timestamptz not null default now(),
  weekly_day_counts_json jsonb not null default '[]'::jsonb,
  meta_json jsonb not null default '{}'::jsonb
);

alter table public.premium_report_eligibility_snapshots enable row level security;

comment on table public.premium_report_eligibility_snapshots is '유료 감응 보고서 버튼 활성 자격 계산 캐시';
