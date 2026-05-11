import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let _supabase: SupabaseClient<Database> | null = null;
if (supabaseUrl && supabaseAnonKey) {
  try {
    _supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      // 브라우저에서는 DB 조회와 Realtime만 사용하므로 Auth 세션 복구/락 로직을 끈다.
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  } catch {
    _supabase = null;
  }
}
export const supabase = _supabase;
