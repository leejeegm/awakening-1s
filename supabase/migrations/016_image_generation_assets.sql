-- 서버 생성 결과(이미지/웹툰) 저장: 히스토리/재다운로드 + 캐시 재사용
create table if not exists public.image_generation_assets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nickname text not null,
  feature_key text not null,
  mode text not null default 'server',
  prompt text not null,
  negative_prompt text null,
  prompt_hash text not null,
  width int null,
  height int null,
  steps int null,
  storage_bucket text not null,
  storage_path text not null,
  engine text null,
  engine_meta jsonb null
);

create index if not exists idx_image_generation_assets_nickname_created_at
  on public.image_generation_assets (nickname, created_at desc);

create index if not exists idx_image_generation_assets_prompt_hash
  on public.image_generation_assets (nickname, feature_key, prompt_hash);

alter table public.image_generation_assets enable row level security;

-- 서비스 역할만 삽입/조회 가능 (anon 불가)
-- 재실행 시 동일 이름 정책 충돌 방지
drop policy if exists "Service role only" on public.image_generation_assets;
create policy "Service role only"
  on public.image_generation_assets for all
  using (false)
  with check (false);

comment on table public.image_generation_assets is '서버 생성 결과 저장(스토리지 경로). 동일 프롬프트 해시 캐시 및 히스토리/재다운로드용.';

