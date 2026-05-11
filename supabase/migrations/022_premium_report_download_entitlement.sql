-- participant_entitlements의 feature_key로 premium_report_download 사용
-- 스키마 변경 없이 값만 확장해 사용

comment on table public.participant_entitlements is
'닉네임별 기능 승인 토글(서버 이미지/웹툰 생성, premium_report_download 등). RLS 정책 없음: 서버(서비스 롤)에서만 접근.';
