/**
 * 공동·개인 닉네임 정합성 테스트 (2회 실행)
 * node --experimental-strip-types scripts/resonance-consistency-test.mjs
 */
import { strictEqual, ok } from "node:assert";
import {
  isSharedScopeRecord,
  normalizeNicknameKey,
} from "../lib/resonanceSharedNickname.ts";

function runRound(round) {
  console.log(`\n=== 정합성 테스트 ${round}회차 ===`);

  strictEqual(isSharedScopeRecord("shared", "teamA", "teamA"), true);
  strictEqual(isSharedScopeRecord("personal", "alice", "teamA"), false);
  strictEqual(isSharedScopeRecord(undefined, "teamA", "teamA"), true);
  strictEqual(isSharedScopeRecord(undefined, "alice", "teamA"), false);
  strictEqual(isSharedScopeRecord(undefined, "TeamA", "teama"), true);
  strictEqual(isSharedScopeRecord("personal", "teamA", "teamA"), false);

  strictEqual(normalizeNicknameKey("  hello  "), "hello");
  strictEqual(normalizeNicknameKey("x".repeat(30)).length, 20);

  // 공동 종료 시 개인 닉네임은 archive 대상 아님 (닉네임 문자열 비교)
  const sharedNick = "couple1";
  const personalNick = "userA";
  const records = [
    { nickname: sharedNick, moderation_state: "ok" },
    { nickname: personalNick, moderation_state: "ok" },
    { nickname: sharedNick, moderation_state: "deleted" },
  ];
  const wouldArchive = records.filter(
    (r) =>
      r.nickname === sharedNick &&
      r.moderation_state === "ok"
  );
  strictEqual(wouldArchive.length, 1);
  ok(!wouldArchive.some((r) => r.nickname === personalNick));

  console.log(`round ${round}: ok`);
}

for (let i = 1; i <= 2; i++) {
  runRound(i);
}

console.log("\nresonance-consistency: 2 rounds passed");
