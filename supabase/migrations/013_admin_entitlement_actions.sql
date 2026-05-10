-- 관리자 기능 승인/해제 로그 (감사/추적)
create table if not exists public.admin_entitlement_actions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nickname text not null,
  feature_key text not null,
  enabled boolean not null,
  expires_at timestamptz null,
  source text null,
  enabled_by text null
);

alter table public.admin_entitlement_actions enable row level security;

-- 서비스 역할만 삽입/조회 가능 (anon 불가)
drop policy if exists "Service role only" on public.admin_entitlement_actions;
create policy "Service role only"
  on public.admin_entitlement_actions for all
  using (false)
  with check (false);

comment on table public.admin_entitlement_actions is '관리자가 닉네임별 기능 승인/해제 시 남기는 로그(감사/추적).';

