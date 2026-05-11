-- 유료 감응 보고서 신청 / 결재 / 승인 / 완료 상태머신

create table if not exists public.premium_report_requests (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  product_id uuid not null references public.premium_report_products(id) on delete restrict,
  status text not null check (
    status in ('requested', 'paid_pending', 'approved', 'in_progress', 'ready', 'rejected', 'expired')
  ) default 'requested',
  payment_status text not null check (
    payment_status in ('unpaid', 'pending_manual_check', 'confirmed', 'failed', 'refunded')
  ) default 'unpaid',
  admin_note text null,
  approved_by text null,
  approved_at timestamptz null,
  downloadable boolean not null default false,
  downloadable_at timestamptz null,
  expires_at timestamptz null,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.premium_report_requests enable row level security;

create or replace function public.touch_premium_report_requests_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_premium_report_requests_updated_at on public.premium_report_requests;
create trigger trg_touch_premium_report_requests_updated_at
before update on public.premium_report_requests
for each row execute function public.touch_premium_report_requests_updated_at();

create index if not exists idx_premium_report_requests_nickname
  on public.premium_report_requests (nickname, requested_at desc);

create index if not exists idx_premium_report_requests_status
  on public.premium_report_requests (status, payment_status, requested_at desc);

comment on table public.premium_report_requests is '유료 감응 보고서 신청/결재/승인/배포 상태';
