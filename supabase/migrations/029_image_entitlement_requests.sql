-- 유료 이미지 승인 요청 (사용자 → 관리자 리스트 → 승인 반영)
create table if not exists public.image_entitlement_requests (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  feature_key text not null check (feature_key in ('image_cut', 'comic_4panel')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'waived')),
  requested_at timestamptz not null default now(),
  payment_confirmed_at timestamptz null,
  payment_note text null,
  reviewed_at timestamptz null,
  reviewed_by text null,
  admin_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_image_entitlement_requests_status_requested
  on public.image_entitlement_requests (status, requested_at desc);

create index if not exists idx_image_entitlement_requests_nickname
  on public.image_entitlement_requests (nickname, requested_at desc);

create unique index if not exists idx_image_entitlement_requests_one_pending
  on public.image_entitlement_requests (nickname, feature_key)
  where status = 'pending';

alter table public.image_entitlement_requests enable row level security;

comment on table public.image_entitlement_requests is
  '유료 서버 이미지 승인 요청. RLS 정책 없음 — 서버(서비스 롤)만 접근.';

create or replace function public.touch_image_entitlement_requests_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_image_entitlement_requests_updated_at on public.image_entitlement_requests;
create trigger trg_touch_image_entitlement_requests_updated_at
before update on public.image_entitlement_requests
for each row execute function public.touch_image_entitlement_requests_updated_at();
