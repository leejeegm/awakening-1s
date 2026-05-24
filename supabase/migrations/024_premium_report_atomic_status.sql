-- 프리미엄 보고서: 중복 신청 방지 + 상태·entitlement 원자적 갱신

create unique index if not exists idx_premium_report_requests_active_nickname
  on public.premium_report_requests (nickname)
  where status in ('requested', 'paid_pending', 'approved', 'in_progress', 'ready');

create or replace function public.apply_premium_report_status(
  p_request_id uuid,
  p_status text,
  p_payment_status text,
  p_admin_note text,
  p_downloadable boolean,
  p_downloadable_at timestamptz,
  p_approved_at timestamptz,
  p_approved_by text,
  p_action_meta jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nickname text;
begin
  update public.premium_report_requests
  set
    status = p_status,
    payment_status = p_payment_status,
    admin_note = p_admin_note,
    downloadable = p_downloadable,
    downloadable_at = p_downloadable_at,
    approved_at = p_approved_at,
    approved_by = p_approved_by
  where id = p_request_id
  returning nickname into v_nickname;

  if not found then
    raise exception 'request_not_found';
  end if;

  insert into public.participant_entitlements (
    nickname, feature_key, enabled, source, enabled_by, expires_at
  )
  values (
    v_nickname, 'premium_report_download', p_downloadable, 'admin', 'admin', null
  )
  on conflict (nickname, feature_key) do update
  set
    enabled = excluded.enabled,
    source = excluded.source,
    enabled_by = excluded.enabled_by;

  insert into public.premium_report_actions (request_id, action, actor, meta_json)
  values (p_request_id, 'status_changed', 'admin', p_action_meta);
end;
$$;

comment on function public.apply_premium_report_status is
  'premium_report_requests 상태 변경 + download entitlement + audit log 원자 처리';
