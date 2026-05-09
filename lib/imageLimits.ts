import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type LimitResult =
  | { allowed: true; usedToday: number; dailyLimit: number; usedMonth: number; monthlyLimit: number }
  | { allowed: false; message: string; usedToday: number; dailyLimit: number; usedMonth: number; monthlyLimit: number };

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

export async function checkAndRecordServerImageUsage(opts: {
  nickname: string;
  featureKey: string;
}): Promise<LimitResult> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return {
      allowed: false,
      message: "DB 연결을 사용할 수 없습니다.",
      usedToday: 0,
      dailyLimit: 0,
      usedMonth: 0,
      monthlyLimit: 0,
    };
  }

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

  // 기본값(관리자 승인 사용자라도 남용 방지 필요)
  const dailyLimit = Number(process.env.IMAGE_DAILY_LIMIT ?? "10");
  const monthlyLimitDefault = Number(process.env.IMAGE_MONTHLY_LIMIT_DEFAULT ?? "50");
  const monthlyLimitBun = Number(process.env.IMAGE_MONTHLY_LIMIT_BUN ?? "280");
  const monthlyLimitSi = Number(process.env.IMAGE_MONTHLY_LIMIT_SI ?? "280");

  // 플랜이 유효하면 월 한도를 우선 적용 (bun/si: 280)
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
    // ignore plan lookup errors (fallback to default)
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

  const usedToday = todayRes.count ?? 0;
  const usedMonth = monthRes.count ?? 0;

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

  const { error } = await admin.from("image_generation_usage").insert({
    nickname,
    feature_key: featureKey,
    mode: "server",
  } as never);

  if (error) {
    return {
      allowed: false,
      message: "사용량 기록에 실패했습니다.",
      usedToday,
      dailyLimit,
      usedMonth,
      monthlyLimit,
    };
  }

  return {
    allowed: true,
    usedToday: usedToday + 1,
    dailyLimit,
    usedMonth: usedMonth + 1,
    monthlyLimit,
  };
}

