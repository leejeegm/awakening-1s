-- 관리자 삭제/수정 로그 (공정성·책임 추적)
create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  action text not null check (action in ('delete', 'update')),
  awakening_id uuid not null,
  old_note text,
  new_note text,
  reason text
);

alter table public.admin_actions enable row level security;

-- 서비스 역할만 삽입/조회 가능 (anon 불가)
create policy "Service role only"
  on public.admin_actions for all
  using (false)
  with check (false);

comment on table public.admin_actions is '관리자가 기록 삭제/수정 시 남기는 로그. 미풍양속·욕설·비방·협박 등 사유로 조치 시 추적용.';
