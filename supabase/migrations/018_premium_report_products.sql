-- 유료 감응 보고서 상품/템플릿 설정

create table if not exists public.premium_report_products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text null,
  default_pages integer not null default 1 check (default_pages between 1 and 50),
  sections_json jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.premium_report_products enable row level security;

create or replace function public.touch_premium_report_products_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_premium_report_products_updated_at on public.premium_report_products;
create trigger trg_touch_premium_report_products_updated_at
before update on public.premium_report_products
for each row execute function public.touch_premium_report_products_updated_at();

comment on table public.premium_report_products is '유료 감응 보고서 상품/템플릿/기본 분량 설정';

insert into public.premium_report_products (code, name, description, default_pages, sections_json, active)
values (
  'jakkae-premium-weekly',
  '나의 자깨 감응 보고서',
  '매주 3일 이상 4주 연속 기록 사용자를 위한 관리자 승인형 유료 보고서',
  4,
  '[
    {"key":"cover","label":"표지","enabled":true},
    {"key":"summary","label":"핵심 요약","enabled":true},
    {"key":"trend","label":"기록 트렌드","enabled":true},
    {"key":"message-history","label":"맞춤 메시지 흐름","enabled":true},
    {"key":"visuals","label":"시각화","enabled":true},
    {"key":"attachment","label":"첨부 자료","enabled":true}
  ]'::jsonb,
  true
)
on conflict (code) do nothing;
