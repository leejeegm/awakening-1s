-- 참가자 프로필: 성별·연령대 (익명 닉네임 기준, 선택 입력)
create table if not exists public.participant_profiles (
  nickname text primary key,
  gender text check (gender in ('male', 'female', 'defer')),
  age_group text check (age_group in (
    '13under', '14_16', '17_19', '20s', '30s', '40s', '50s', '60s', '70over', 'defer'
  )),
  updated_at timestamptz not null default now()
);

alter table public.participant_profiles enable row level security;

drop policy if exists "Allow public read profiles" on public.participant_profiles;
create policy "Allow public read profiles"
  on public.participant_profiles for select using (true);

drop policy if exists "Allow insert and update profiles" on public.participant_profiles;
create policy "Allow insert and update profiles"
  on public.participant_profiles for all
  using (true) with check (true);

comment on table public.participant_profiles is '닉네임별 성별·연령대(선택). 남/여/보류, 13세이하~70대이상/보류.';

-- AI 생성 콘텐츠 저장: 시간 흐름·연관성 기반 맞춤(성별·연령대) 멘트 제공용
create table if not exists public.ai_generated_content (
  id uuid primary key default gen_random_uuid(),
  nickname text,
  content_type text not null check (content_type in ('insight_card', 'warm_message', 'weekly_summary')),
  content text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_generated_nickname on public.ai_generated_content(nickname);
create index if not exists idx_ai_generated_type_created on public.ai_generated_content(content_type, created_at desc);

alter table public.ai_generated_content enable row level security;

drop policy if exists "Allow public read ai_content" on public.ai_generated_content;
create policy "Allow public read ai_content"
  on public.ai_generated_content for select using (true);

drop policy if exists "Allow service insert ai_content" on public.ai_generated_content;
create policy "Allow service insert ai_content"
  on public.ai_generated_content for insert with check (true);

comment on table public.ai_generated_content is 'AI 생성 문구 저장. 시간·연관성 기반 맞춤(성별·연령대) 멘트 제공용.';
