-- 자깨초시 실험: 자각 기록 테이블 (실명/연락처 수집 없음)
create table if not exists public.awakenings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nickname text not null,
  note text not null
);

alter table public.awakenings enable row level security;

create policy "Allow public read"
  on public.awakenings for select
  using (true);

create policy "Allow public insert"
  on public.awakenings for insert
  with check (true);

-- 전체 자각 횟수 집계용 (선택) 뷰
create or replace view public.awakening_count as
select count(*)::int as total from public.awakenings;

grant select on public.awakening_count to anon;

-- Realtime 사용 시: Supabase Dashboard → Database → Replication 에서 awakenings 테이블 활성화
