const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

async function hmacSha256B64url(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return bytesToB64url(new Uint8Array(sig));
}

/** Edge Runtime(middleware)용 관리자 쿠키 검증 */
export async function verifyAdminTokenEdge(token: string | undefined | null): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET ?? "";
  if (!secret || !token) return false;
  const [rawT, hmac] = token.split(".");
  if (!rawT || !hmac) return false;
  try {
    const t = parseInt(new TextDecoder().decode(b64urlToBytes(rawT)), 10);
    if (Number.isNaN(t) || Date.now() - t > MAX_AGE_MS) return false;
    const expected = await hmacSha256B64url(secret, String(t));
    return timingSafeEqualBytes(b64urlToBytes(hmac), b64urlToBytes(expected));
  } catch {
    return false;
  }
}
