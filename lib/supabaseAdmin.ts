import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** 서버 전용. RLS 무시하여 삭제/수정 가능. 클라이언트에 노출 금지. */
export function getSupabaseAdmin() {
  if (!url || !serviceRoleKey) return null;
  return createClient<Database>(url, serviceRoleKey);
}
