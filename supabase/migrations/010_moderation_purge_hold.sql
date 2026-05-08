-- 폐기 유보: true이면 보관 기간이 지나도 자동/일괄 폐기 대상에서 제외 (관리자가 수동 해제 후 폐기)
alter table public.awakenings
  add column if not exists purge_hold boolean not null default false;

comment on column public.awakenings.purge_hold is '삭제(보관) 건의 폐기 유보. true면 MODERATION_QUARANTINE_DAYS 경과 후에도 일괄 폐기에서 제외.';
