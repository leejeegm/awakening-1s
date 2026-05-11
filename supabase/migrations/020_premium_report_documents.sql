-- 원천 스냅샷 / 편집 문서 / 첨부 자산 / 액션 로그

create table if not exists public.premium_report_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.premium_report_requests(id) on delete cascade,
  profile_json jsonb not null default '{}'::jsonb,
  trend_json jsonb not null default '{}'::jsonb,
  ai_history_json jsonb not null default '[]'::jsonb,
  record_window_from timestamptz not null,
  record_window_to timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.premium_report_documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.premium_report_requests(id) on delete cascade,
  version integer not null default 1,
  title text not null,
  summary_text text null,
  sections_json jsonb not null default '[]'::jsonb,
  page_count integer not null default 1 check (page_count between 1 and 100),
  pdf_status text not null check (pdf_status in ('draft', 'generating', 'ready', 'failed')) default 'draft',
  created_by text null,
  updated_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, version)
);

create table if not exists public.premium_report_assets (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.premium_report_requests(id) on delete cascade,
  asset_type text not null check (
    asset_type in ('chart_image', 'attachment_pdf', 'attachment_image', 'final_pdf', 'analysis_note')
  ),
  storage_bucket text null,
  storage_path text null,
  mime_type text null,
  meta_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.premium_report_actions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.premium_report_requests(id) on delete cascade,
  action text not null,
  actor text null,
  meta_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.premium_report_source_snapshots enable row level security;
alter table public.premium_report_documents enable row level security;
alter table public.premium_report_assets enable row level security;
alter table public.premium_report_actions enable row level security;

create or replace function public.touch_premium_report_documents_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_premium_report_documents_updated_at on public.premium_report_documents;
create trigger trg_touch_premium_report_documents_updated_at
before update on public.premium_report_documents
for each row execute function public.touch_premium_report_documents_updated_at();

create index if not exists idx_premium_report_documents_request
  on public.premium_report_documents (request_id, version desc);

create index if not exists idx_premium_report_assets_request
  on public.premium_report_assets (request_id, created_at desc);

create index if not exists idx_premium_report_actions_request
  on public.premium_report_actions (request_id, created_at desc);
