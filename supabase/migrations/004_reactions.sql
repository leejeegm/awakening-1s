-- 타인의 기록에 대한 반응: 감(긍정적 느낌), 응(구독 반응)
-- 닉네임 노출 없이 집계만 공유
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  awakening_id uuid not null references public.awakenings(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('gam', 'eung')),
  created_at timestamptz not null default now()
);

create index if not exists idx_reactions_awakening on public.reactions(awakening_id);
create index if not exists idx_reactions_type on public.reactions(reaction_type);

alter table public.reactions enable row level security;

create policy "Allow public read reactions"
  on public.reactions for select using (true);

create policy "Allow public insert reactions"
  on public.reactions for insert with check (true);
