import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { hintFromPgError } from "@/lib/pgErrorHints";

export type LimitResult =
  | { allowed: true; usedToday: number; dailyLimit: number; usedMonth: number; monthlyLimit: number }
  | { allowed: false; message: string; usedToday: number; dailyLimit: number; usedMonth: number; monthlyLimit: number };

export type ServerImageUsageSnapshot =
  | {
      ok: true;
      usedToday: number;
      dailyLimit: number;
      usedMonth: number;
      monthlyLimit: number;
      lastUsedAt: string | null;
    }
  | {
      ok: false;
      message: string;
      usedToday: number;
      dailyLimit: number;
      usedMonth: number;
      monthlyLimit: number;
      lastUsedAt: string | null;
    };

function startOfTodayKSTIso(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m, d] = formatter.format(now).split("-");
  return `${y}-${m}-${d}T00:00:00+09:00`;
}

function startOfMonthKSTIso(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  });
  const [y, m] = formatter.format(now).split("-");
  return `${y}-${m}-01T00:00:00+09:00`;
}

async function loadUsageCounts(nickname: string) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return {
      ok: false as const,
      message: "DB 연결을 사용할 수 없습니다.",
      usedToday: 0,
      dailyLimit: 0,
      usedMonth: 0,
      monthlyLimit: 0,
    };
  }

  const dailyLimit = Number(process.env.IMAGE_DAILY_LIMIT ?? "10");
  const monthlyLimitDefault = Number(process.env.IMAGE_MONTHLY_LIMIT_DEFAULT ?? "50");
  const monthlyLimitBun = Number(process.env.IMAGE_MONTHLY_LIMIT_BUN ?? "280");
  const monthlyLimitSi = Number(process.env.IMAGE_MONTHLY_LIMIT_SI ?? "280");

  let monthlyLimit = monthlyLimitDefault;
  try {
    const { data } = await admin
      .from("participant_plans")
      .select("plan_type, valid_until")
      .eq("nickname", nickname)
      .maybeSingle() as { data: { plan_type: string; valid_until: string } | null };
    if (data && new Date(data.valid_until) > new Date()) {
      if (data.plan_type === "bun") monthlyLimit = monthlyLimitBun;
      else if (data.plan_type === "si") monthlyLimit = monthlyLimitSi;
    }
  } catch {
    // ignore
  }

  const todayStart = startOfTodayKSTIso();
  const monthStart = startOfMonthKSTIso();

  const todayRes = await admin
    .from("image_generation_usage")
    .select("id", { count: "exact", head: true })
    .eq("nickname", nickname)
    .gte("created_at", todayStart);

  const monthRes = await admin
    .from("image_generation_usage")
    .select("id", { count: "exact", head: true })
    .eq("nickname", nickname)
    .gte("created_at", monthStart);

  const lastRes = await admin
    .from("image_generation_usage")
    .select("created_at")
    .eq("nickname", nickname)
    .order("created_at", { ascending: false })
    .limit(1);

  const countErr = todayRes.error ?? monthRes.error ?? lastRes.error;
  if (countErr) {
    const hint = hintFromPgError(countErr.message, countErr.code);
    return {
      ok: false as const,
      message: hint ?? `사용량 조회에 실패했습니다. (${countErr.message})`,
      usedToday: 0,
      dailyLimit,
      usedMonth: 0,
      monthlyLimit,
      lastUsedAt: null,
    };
  }

  return {
    ok: true as const,
    usedToday: todayRes.count ?? 0,
    usedMonth: monthRes.count ?? 0,
    dailyLimit,
    monthlyLimit,
    lastUsedAt:
      Array.isArray(lastRes.data) && lastRes.data.length > 0
        ? ((lastRes.data[0] as { created_at?: string | null })?.created_at ?? null)
        : null,
  };
}

export async function getServerImageUsageSnapshot(opts: { nickname: string }): Promise<ServerImageUsageSnapshot> {
  const nickname = (opts.nickname ?? "").trim().toLowerCase();
  if (!nickname) {
    return {
      ok: false,
      message: "닉네임이 필요합니다.",
      usedToday: 0,
      dailyLimit: 0,
      usedMonth: 0,
      monthlyLimit: 0,
      lastUsedAt: null,
    };
  }
  const snap = await loadUsageCounts(nickname);
  return snap.ok
    ? {
        ok: true,
        usedToday: snap.usedToday,
        dailyLimit: snap.dailyLimit,
        usedMonth: snap.usedMonth,
        monthlyLimit: snap.monthlyLimit,
        lastUsedAt: snap.lastUsedAt ?? null,
      }
    : {
        ok: false,
        message: snap.message,
        usedToday: snap.usedToday,
        dailyLimit: snap.dailyLimit,
        usedMonth: snap.usedMonth,
        monthlyLimit: snap.monthlyLimit,
        lastUsedAt: snap.lastUsedAt ?? null,
      };
}

/** 한도만 확인(기록 없음) — 비동기 작업 생성 시 */
export async function checkServerImageUsage(opts: {
  nickname: string;
}): Promise<LimitResult> {
  const nickname = (opts.nickname ?? "").trim().toLowerCase();
  if (!nickname) {
    return {
      allowed: false,
      message: "닉네임이 필요합니다.",
      usedToday: 0,
      dailyLimit: 0,
      usedMonth: 0,
      monthlyLimit: 0,
    };
  }

  const snap = await loadUsageCounts(nickname);
  if (!snap.ok) {
    return {
      allowed: false,
      message: snap.message,
      usedToday: snap.usedToday,
      dailyLimit: snap.dailyLimit,
      usedMonth: snap.usedMonth,
      monthlyLimit: snap.monthlyLimit,
    };
  }

  const { usedToday, usedMonth, dailyLimit, monthlyLimit } = snap;
  if (Number.isFinite(dailyLimit) && usedToday >= dailyLimit) {
    return {
      allowed: false,
      message: `오늘 서버 이미지 생성 한도(${dailyLimit}회)를 모두 사용했습니다.`,
      usedToday,
      dailyLimit,
      usedMonth,
      monthlyLimit,
    };
  }
  if (Number.isFinite(monthlyLimit) && usedMonth >= monthlyLimit) {
    return {
      allowed: false,
      message: `이번 달 서버 이미지 생성 한도(${monthlyLimit}회)를 모두 사용했습니다.`,
      usedToday,
      dailyLimit,
      usedMonth,
      monthlyLimit,
    };
  }

  return { allowed: true, usedToday, dailyLimit, usedMonth, monthlyLimit };
}

/** 생성 성공 후 사용량 1회 기록 */
export async function recordServerImageUsage(opts: {
  nickname: string;
  featureKey: string;
}): Promise<LimitResult> {
  const nickname = (opts.nickname ?? "").trim().toLowerCase();
  const featureKey = (opts.featureKey ?? "").trim();
  const snap = await checkServerImageUsage({ nickname });
  if (!snap.allowed) return snap;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return {
      allowed: false,
      message: "DB 연결을 사용할 수 없습니다.",
      usedToday: snap.usedToday,
      dailyLimit: snap.dailyLimit,
      usedMonth: snap.usedMonth,
      monthlyLimit: snap.monthlyLimit,
    };
  }

  const { error } = await admin.from("image_generation_usage").insert({
    nickname,
    feature_key: featureKey,
    mode: "server",
  } as never);

  if (error) {
    const hint = hintFromPgError(error.message, error.code);
    return {
      allowed: false,
      message: hint ?? `사용량 기록에 실패했습니다. (${error.message})`,
      usedToday: snap.usedToday,
      dailyLimit: snap.dailyLimit,
      usedMonth: snap.usedMonth,
      monthlyLimit: snap.monthlyLimit,
    };
  }

  return {
    allowed: true,
    usedToday: snap.usedToday + 1,
    dailyLimit: snap.dailyLimit,
    usedMonth: snap.usedMonth + 1,
    monthlyLimit: snap.monthlyLimit,
  };
}

export async function checkAndRecordServerImageUsage(opts: {
  nickname: string;
  featureKey: string;
}): Promise<LimitResult> {
  const nickname = (opts.nickname ?? "").trim().toLowerCase();
  const featureKey = (opts.featureKey ?? "").trim();
  if (!nickname || !featureKey) {
    return {
      allowed: false,
      message: "닉네임/기능키가 필요합니다.",
      usedToday: 0,
      dailyLimit: 0,
      usedMonth: 0,
      monthlyLimit: 0,
    };
  }

  const snap = await checkServerImageUsage({ nickname });
  if (!snap.allowed) return snap;
  return recordServerImageUsage({ nickname, featureKey });
}

