/**
 * CI smoke checks — DB/API 없이 핵심 유틸 동작 검증
 */
import { strictEqual } from "node:assert";
import { timingSafeEqual, createHmac } from "node:crypto";

function safeEqualString(a, b) {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

strictEqual(safeEqualString("abc", "abc"), true);
strictEqual(safeEqualString("abc", "abd"), false);
strictEqual(safeEqualString("abc", "ab"), false);

const secret = "smoke-test-secret";
const t = String(Date.now());
const hmac = createHmac("sha256", secret).update(t).digest("base64url");
const token = `${Buffer.from(t).toString("base64url")}.${hmac}`;
const [rawT, sig] = token.split(".");
const expected = createHmac("sha256", secret).update(String(parseInt(Buffer.from(rawT, "base64url").toString(), 10))).digest("base64url");
strictEqual(safeEqualString(sig, expected), true);

console.log("smoke: ok");
