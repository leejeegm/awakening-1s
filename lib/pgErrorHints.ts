/** Supabase/PostgREST 오류 메시지에 따른 한글 안내(운영·마이그레이션 누락 등) */
export function hintFromPgError(message: string | undefined, code: string | undefined): string | undefined {
  const m = (message ?? "").toLowerCase();
  const c = code ?? "";

  if (c === "42P01" || m.includes("does not exist") || m.includes("undefined table")) {
    return "Supabase에 해당 테이블이 없습니다. supabase/migrations 폴더의 최신 SQL(예: 014·016)을 순서대로 실행했는지 확인해 주세요.";
  }
  if (m.includes("row-level security") || m.includes("policy") || c === "42501") {
    return "RLS 또는 권한 문제입니다. SUPABASE_SERVICE_ROLE_KEY가 올바른지, 마이그레이션으로 정책이 생성되었는지 확인해 주세요.";
  }
  if (
    m.includes("storage") &&
    (m.includes("bucket") || m.includes("not found") || m.includes("does not exist"))
  ) {
    return "Storage 버킷이 없거나 경로가 잘못되었습니다. 대시보드에서 버킷(기본 이름: generated)을 만들거나 IMAGE_BUCKET 환경 변수를 확인해 주세요.";
  }
  return undefined;
}
