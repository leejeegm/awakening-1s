-- 2026-05-08 이전(오늘 이전) 기존 기록은 공개 유지
-- 정책: 오늘부터 새로 저장된 기록은 기본 비공개(나만보기)이며, 공유저장(is_public=true)만 공개 피드/집계에 노출.
-- 기존 데이터(필드 추가 이전에 작성된 기록)는 공개 경험을 유지하기 위해 is_public=true로 백필.

update public.awakenings
set is_public = true
where created_at < '2026-05-08T00:00:00.000+09:00'::timestamptz
  and moderation_state = 'ok'
  and (is_public is distinct from true);

