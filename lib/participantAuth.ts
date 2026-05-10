import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/** 닉네임 + 비밀번호 SHA-256(hex)가 participant_keys와 일치하는지 (서버 전용, 닉네임은 클라이언트와 동일 대소문자) */
export async function verifyParticipantAuthHash(nickname: string, authHash: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  if (!admin) return false;
  const n = (nickname ?? "").trim().slice(0, 20);
  const h = (authHash ?? "").trim().toLowerCase();
  if (!n || !h) return false;

  const { data } = await admin
    .from("participant_keys")
    .select("password_hash")
    .eq("nickname", n)
    .maybeSingle();

  const row = data as { password_hash?: string | null } | null;
  const stored = row?.password_hash?.trim().toLowerCase();
  return !!stored && stored === h;
}
