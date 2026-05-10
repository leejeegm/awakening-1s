-- 서버 이미지/웹툰 생성 사용량(남용 방지/한도 체크)
create table if not exists public.image_generation_usage (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nickname text not null,
  feature_key text not null,
  mode text not null default 'server' -- server/local 등 기록용
);

create index if not exists idx_image_generation_usage_nickname_created_at
  on public.image_generation_usage (nickname, created_at desc);

alter table public.image_generation_usage enable row level security;

-- 서비스 역할만 삽입/조회 가능 (anon 불가)
drop policy if exists "Service role only" on public.image_generation_usage;
create policy "Service role only"
  on public.image_generation_usage for all
  using (false)
  with check (false);

comment on table public.image_generation_usage is '서버 이미지/웹툰 생성 사용량 기록(닉네임별 한도 체크/남용 방지).';

