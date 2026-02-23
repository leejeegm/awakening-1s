-- 닉네임별 비밀번호 해시 (내 기록 조회용). password_hint는 003에서 추가.
create table if not exists public.participant_keys (
  nickname text primary key,
  password_hash text not null
);

alter table public.participant_keys enable row level security;

create policy "Allow public select participant_keys"
  on public.participant_keys for select
  using (true);

create policy "Allow public insert participant_keys"
  on public.participant_keys for insert
  with check (true);
