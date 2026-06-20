/**
 * 운영/로컬 API 데이터 정합성 스모크
 * BASE_URL=https://awakening-1s.vercel.app node scripts/data-integrity.mjs
 */
import { ok, strictEqual } from "node:assert";

const base = (process.env.BASE_URL ?? "https://awakening-1s.vercel.app").replace(/\/$/, "");

async function getJson(path) {
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function assertOk(label, status, body) {
  ok(status >= 200 && status < 300, `${label}: HTTP ${status} ${JSON.stringify(body)}`);
}

const version = await getJson("/api/version");
assertOk("version", version.status, version.json);
ok(typeof version.json.commitShortSha === "string", "version.commitShortSha missing");

const stats = await getJson("/api/stats/awakenings");
assertOk("stats", stats.status, stats.json);
ok(
  stats.json.totalRecords === null || typeof stats.json.totalRecords === "number",
  "totalRecords type"
);
ok(
  stats.json.myRecordCount === null || typeof stats.json.myRecordCount === "number",
  "myRecordCount type"
);

if (typeof stats.json.totalRecords === "number") {
  ok(stats.json.totalRecords >= 0, "totalRecords >= 0");
}

const nickStats = await getJson("/api/stats/awakenings?nickname=integrity_probe");
assertOk("stats nickname", nickStats.status, nickStats.json);
if (
  typeof nickStats.json.myRecordCount === "number" &&
  typeof stats.json.totalRecords === "number"
) {
  ok(
    nickStats.json.myRecordCount <= stats.json.totalRecords,
    "myRecordCount must be <= totalRecords"
  );
}

const feed = await getJson("/api/feed/awakenings");
assertOk("feed", feed.status, feed.json);
ok(Array.isArray(feed.json.items), "feed.items must be array");
for (const item of feed.json.items) {
  ok(typeof item.note === "string", "feed item note");
  if ("is_public" in item) {
    strictEqual(item.is_public, true, "public feed must be is_public=true");
  }
}

if (typeof stats.json.totalRecords === "number" && feed.json.items.length > 0) {
  ok(
    feed.json.items.length <= stats.json.totalRecords,
    "public feed rows cannot exceed total ok records"
  );
}

console.log(
  JSON.stringify(
    {
      integrity: "ok",
      base,
      commit: version.json.commitShortSha,
      totalRecords: stats.json.totalRecords,
      feedItems: feed.json.items.length,
    },
    null,
    2
  )
);
