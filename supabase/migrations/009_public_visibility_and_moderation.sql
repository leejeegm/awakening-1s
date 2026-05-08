-- 공개/비공개(나만보기) + 모더레이션/삭제(보관) 필드 추가
alter table public.awakenings
  add column if not exists is_public boolean not null default false,
  add column if not exists moderation_state text not null default 'ok' check (moderation_state in ('ok','deleted')),
  add column if not exists moderation_reason text,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text;

create index if not exists idx_awakenings_public_created on public.awakenings(is_public, created_at desc);
create index if not exists idx_awakenings_moderation on public.awakenings(moderation_state, deleted_at desc);

-- 공개 글만 읽을 수 있도록 정책 조정 (비공개/삭제보관은 서버 API로만 조회)
drop policy if exists "Allow public read" on public.awakenings;
create policy "Allow public read public only"
  on public.awakenings for select
  using (is_public = true and moderation_state = 'ok');

