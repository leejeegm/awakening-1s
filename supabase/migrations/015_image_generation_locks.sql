-- 서버 이미지 생성 동시 실행 방지(닉네임당 1개 작업)
create table if not exists public.image_generation_locks (
  nickname text primary key,
  locked_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.image_generation_locks enable row level security;

-- 서비스 역할만 삽입/조회/삭제 가능 (anon 불가)
create policy "Service role only"
  on public.image_generation_locks for all
  using (false)
  with check (false);

create or replace function public.touch_image_generation_locks_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_image_generation_locks_updated_at on public.image_generation_locks;
create trigger trg_touch_image_generation_locks_updated_at
before update on public.image_generation_locks
for each row execute function public.touch_image_generation_locks_updated_at();

comment on table public.image_generation_locks is '닉네임별 서버 이미지 생성 동시 실행 방지 락. locked_until 이전에는 새 작업 거부.';

