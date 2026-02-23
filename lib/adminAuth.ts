import { cookies } from "next/headers";

const COOKIE_NAME = "admin_session";
const MAX_AGE_SEC = 60 * 60 * 24; // 24시간

function getSecret() {
  return process.env.ADMIN_SECRET ?? "";
}

export function isAdminConfigured() {
  return !!getSecret() && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/** 비밀번호가 관리자 비밀과 일치하는지 */
export function verifyAdminPassword(password: string): boolean {
  const secret = getSecret();
  return secret.length > 0 && password === secret;
}

/** 쿠키에 담을 토큰 생성 (timestamp + HMAC) */
export function createAdminToken(): string {
  const secret = getSecret();
  if (!secret) return "";
  const crypto = require("crypto");
  const t = String(Date.now());
  const hmac = crypto.createHmac("sha256", secret).update(t).digest("base64url");
  return `${Buffer.from(t).toString("base64url")}.${hmac}`;
}

/** 쿠키 토큰 검증 및 만료 확인 */
export async function verifyAdminCookie(): Promise<boolean> {
  const secret = getSecret();
  if (!secret) return false;
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const [rawT, hmac] = token.split(".");
  if (!rawT || !hmac) return false;
  try {
    const t = parseInt(Buffer.from(rawT, "base64url").toString(), 10);
    if (Number.isNaN(t) || Date.now() - t > MAX_AGE_SEC * 1000) return false;
    const crypto = require("crypto");
    const expected = crypto.createHmac("sha256", secret).update(String(t)).digest("base64url");
    return hmac === expected;
  } catch {
    return false;
  }
}

export async function setAdminCookie() {
  const token = createAdminToken();
  if (!token) return;
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SEC,
    path: "/",
  });
}

export async function clearAdminCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export { COOKIE_NAME };
