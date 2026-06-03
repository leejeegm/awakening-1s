import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/** 실험 종료 시 공동 닉네임으로 저장된 기록만 보관 해제(soft delete). 개인 닉네임 기록은 유지. */
export async function archiveSharedExperimentRecords(
  admin: SupabaseClient<Database>,
  sharedNickname: string
): Promise<{ archived: number; error: string | null }> {
  const nick = sharedNickname.trim().slice(0, 20);
  if (!nick) return { archived: 0, error: null };

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("awakenings")
    .update({
      moderation_state: "deleted",
      moderation_reason: "실험 종료(공동 닉네임 기록 보관 해제)",
      deleted_at: now,
      deleted_by: "experiment_end",
      is_public: false,
    } as never)
    .eq("nickname", nick)
    .eq("moderation_state", "ok")
    .select("id");

  if (error) return { archived: 0, error: error.message };
  return { archived: data?.length ?? 0, error: null };
}
