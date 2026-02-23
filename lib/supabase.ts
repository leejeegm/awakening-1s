import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let _supabase: SupabaseClient<Database> | null = null;
if (supabaseUrl && supabaseAnonKey) {
  try {
    _supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
  } catch {
    _supabase = null;
  }
}
export const supabase = _supabase;
