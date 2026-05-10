import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { hintFromPgError } from "@/lib/pgErrorHints";
import type { Database } from "@/types/supabase";

type ImageLockUntilRow = Pick<Database["public"]["Tables"]["image_generation_locks"]["Row"], "locked_until">;

function formatDbErr(err: { message?: string; code?: string }, fallback: string) {
  const msg = err.message?.trim() || fallback;
  const hint = hintFromPgError(err.message, err.code);
  return hint ? `${msg} — ${hint}` : msg;
}

export async function acquireImageLock(nickname: string, ttlMs = 2 * 60 * 1000) {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false as const, error: "DB 연결을 사용할 수 없습니다." };
  const n = (nickname ?? "").trim().toLowerCase();
  if (!n) return { ok: false as const, error: "닉네임이 필요합니다." };

  const now = Date.now();
  const lockedUntil = new Date(now + ttlMs).toISOString();

  // 기존 락 확인
  const { data, error: selErr } = await admin
    .from("image_generation_locks")
    .select("locked_until")
    .eq("nickname", n)
    .maybeSingle();

  if (selErr) return { ok: false as const, error: formatDbErr(selErr, "락 상태 확인 실패") };

  const existing = data as ImageLockUntilRow | null;
  if (existing?.locked_until && new Date(existing.locked_until).getTime() > now) {
    return {
      ok: false as const,
      error: "이미 생성 중입니다. 잠시 후 다시 시도해 주세요.",
      locked_until: existing.locked_until,
    };
  }

  // 만료/없음 → 락 획득(업서트)
  const { error } = await admin.from("image_generation_locks").upsert(
    {
      nickname: n,
      locked_until: lockedUntil,
    } as never,
    { onConflict: "nickname" }
  );
  if (error) return { ok: false as const, error: formatDbErr(error, "락 획득 실패") };
  return { ok: true as const, locked_until: lockedUntil };
}

export async function releaseImageLock(nickname: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const n = (nickname ?? "").trim().toLowerCase();
  if (!n) return;
  try {
    await admin.from("image_generation_locks").delete().eq("nickname", n);
  } catch {
    // ignore
  }
}

