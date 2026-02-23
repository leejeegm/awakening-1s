/** 한국 0시 기준 오늘 시작 시각 (ISO 문자열) */
export function startOfTodayKST(): string {
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

/** 이번 달 1일 0시 KST */
export function startOfMonthKST(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  });
  const [y, m] = formatter.format(now).split("-");
  return `${y}-${m}-01T00:00:00+09:00`;
}

/** 올해 1월 1일 0시 KST */
export function startOfYearKST(): string {
  const now = new Date();
  const y = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric" }).format(now);
  return `${y}-01-01T00:00:00+09:00`;
}

export type PlanType = "free" | "cho" | "bun" | "si";

export const PLAN_LABELS: Record<PlanType, string> = {
  free: "기본(텍스트만) 무료",
  cho: "초°설계자",
  bun: "분°설계자",
  si: "시°설계자",
};

export const PLAN_DAILY_LIMIT: Record<PlanType, number> = {
  free: 10,
  cho: 999,
  bun: 999,
  si: 999,
};

export const PLAN_PERIOD_LIMIT: Partial<Record<PlanType, { period: "month" | "year"; count: number }>> = {
  cho: { period: "month", count: 720 },
  bun: { period: "month", count: 1000 },
  si: { period: "year", count: 1000 },
};

export const PLAN_PRICE: Partial<Record<PlanType, string>> = {
  cho: "7,200원/월",
  bun: "9,900원/월 (이미지 280컷 포함)",
  si: "1,000,000원/년 (이미지 280컷 + 멤버십)",
};

/** 클라이언트에서 사용할 수 있도록 Supabase 클라이언트 타입만 의존 */
type CountFetcher = (nickname: string, sinceIso: string) => Promise<number>;

export async function checkRecordLimit(
  nickname: string,
  fetchCount: CountFetcher,
  fetchPlan: (nickname: string) => Promise<{ plan_type: string; valid_until: string } | null>
): Promise<{ allowed: boolean; message?: string; planType: PlanType; usedToday: number; usedPeriod?: number }> {
  const n = nickname.trim();
  if (!n) return { allowed: true, planType: "free", usedToday: 0 };

  const planRow = await fetchPlan(n);
  const now = new Date().toISOString();
  let planType: PlanType = "free";
  let since = startOfTodayKST();
  let limit = PLAN_DAILY_LIMIT.free;

  if (planRow && new Date(planRow.valid_until) > new Date()) {
    planType = planRow.plan_type as PlanType;
    const period = PLAN_PERIOD_LIMIT[planType as keyof typeof PLAN_PERIOD_LIMIT];
    if (period) {
      since = period.period === "month" ? startOfMonthKST() : startOfYearKST();
      limit = period.count;
    }
  }

  const usedToday = await fetchCount(n, startOfTodayKST());
  const usedPeriod = planType !== "free" ? await fetchCount(n, since) : undefined;

  const used = planType === "free" ? usedToday : (usedPeriod ?? 0);
  if (used >= limit) {
    const msg =
      planType === "free"
        ? `오늘 기록 한도(${limit}회/일)를 모두 사용했습니다. 내일 0시에 초기화됩니다.`
        : `이번 ${PLAN_PERIOD_LIMIT[planType as keyof typeof PLAN_PERIOD_LIMIT]?.period === "month" ? "달" : "해"} 한도(${limit}회)를 모두 사용했습니다.`;
    return { allowed: false, message: msg, planType, usedToday, usedPeriod };
  }
  return { allowed: true, planType, usedToday, usedPeriod };
}
