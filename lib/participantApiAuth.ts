import { NextResponse } from "next/server";
import { verifyParticipantAuthHash } from "@/lib/participantAuth";

export async function requireParticipantAuth(
  rawNickname: string,
  authHash: string
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const n = (rawNickname ?? "").trim().slice(0, 20);
  const h = (authHash ?? "").trim();
  if (!n || !h) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "인증이 필요합니다.", requiresAuth: true },
        { status: 401 }
      ),
    };
  }
  const verified = await verifyParticipantAuthHash(n, h);
  if (!verified) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "인증에 실패했습니다.", requiresAuth: true },
        { status: 401 }
      ),
    };
  }
  return { ok: true };
}
