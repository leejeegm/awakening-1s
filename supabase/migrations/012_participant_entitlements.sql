-- 사용자별 유료/승인 기능 토글 (서버 생성 기능 게이트)
create table if not exists public.participant_entitlements (
  nickname text not null,
  feature_key text not null,
  enabled boolean not null default false,
  enabled_by text null,
  source text null, -- e.g. 'admin', 'payment', 'promo'
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (nickname, feature_key)
);

alter table public.participant_entitlements enable row level security;

-- 의도적으로 정책을 두지 않습니다.
-- 이 테이블은 인증된 관리자/API(서비스 롤)만 접근하며, 클라이언트(Supabase anon)에서 직접 조회할 수 없게 유지합니다.

create or replace function public.touch_participant_entitlements_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_participant_entitlements_updated_at on public.participant_entitlements;
create trigger trg_touch_participant_entitlements_updated_at
before update on public.participant_entitlements
for each row execute function public.touch_participant_entitlements_updated_at();

comment on table public.participant_entitlements is '닉네임별 기능 승인 토글(서버 이미지/웹툰 생성 등). RLS 정책 없음: 서버(서비스 롤)에서만 접근.';

