-- 서버 이미지 비동기 작업 (Vercel Hobby: 요청만 받고 폴링으로 결과 조회)
create table if not exists public.image_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  nickname text not null,
  feature_key text not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'failed')),
  prompt text not null,
  negative_prompt text null,
  prompt_hash text not null,
  width int not null,
  height int not null,
  steps int not null,
  error_message text null,
  storage_bucket text null,
  storage_path text null,
  result_width int null,
  result_height int null
);

create index if not exists idx_image_generation_jobs_nickname_created
  on public.image_generation_jobs (nickname, created_at desc);

create index if not exists idx_image_generation_jobs_status_updated
  on public.image_generation_jobs (status, updated_at);

alter table public.image_generation_jobs enable row level security;

drop policy if exists "Service role only image jobs" on public.image_generation_jobs;
create policy "Service role only image jobs"
  on public.image_generation_jobs for all
  using (false)
  with check (false);

comment on table public.image_generation_jobs is '서버 이미지 비동기 작업. 클라이언트 폴링 시 running→엔진 호출→done/failed.';
