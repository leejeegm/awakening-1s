import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function acquireImageLock(nickname: string, ttlMs = 2 * 60 * 1000) {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false as const, error: "DB 연결을 사용할 수 없습니다." };
  const n = (nickname ?? "").trim().toLowerCase();
  if (!n) return { ok: false as const, error: "닉네임이 필요합니다." };

  const now = Date.now();
  const lockedUntil = new Date(now + ttlMs).toISOString();

  // 기존 락 확인
  const { data } = await admin
    .from("image_generation_locks")
    .select("locked_until")
    .eq("nickname", n)
    .maybeSingle();

  if (data?.locked_until && new Date(data.locked_until).getTime() > now) {
    return { ok: false as const, error: "이미 생성 중입니다. 잠시 후 다시 시도해 주세요.", locked_until: data.locked_until };
  }

  // 만료/없음 → 락 획득(업서트)
  const { error } = await admin.from("image_generation_locks").upsert(
    {
      nickname: n,
      locked_until: lockedUntil,
    } as never,
    { onConflict: "nickname" }
  );
  if (error) return { ok: false as const, error: "락 획득 실패" };
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

