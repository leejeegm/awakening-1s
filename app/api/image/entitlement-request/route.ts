import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyParticipantAuthHash } from "@/lib/participantAuth";
import { normalizeNickname } from "@/lib/entitlements";
import {
  createImageEntitlementRequests,
  listImageEntitlementRequestsForNickname,
  parseImageEntitlementFeatures,
} from "@/lib/imageEntitlementRequests";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawNick = (searchParams.get("nickname") ?? "").trim().slice(0, 20);
  const nickname = normalizeNickname(rawNick);
  const authHash = (searchParams.get("authHash") ?? "").trim();

  if (!nickname) {
    return NextResponse.json({ ok: false, error: "닉네임이 필요합니다." }, { status: 400 });
  }
  if (!authHash) {
    return NextResponse.json({ ok: false, error: "인증이 필요합니다.", requiresAuth: true }, { status: 401 });
  }
  if (!(await verifyParticipantAuthHash(rawNick, authHash))) {
    return NextResponse.json({ ok: false, error: "인증에 실패했습니다.", requiresAuth: true }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "DB 연결을 사용할 수 없습니다." }, { status: 503 });
  }

  const requests = await listImageEntitlementRequestsForNickname(admin, nickname, 20);
  const pending = requests.filter((r) => r.status === "pending");

  return NextResponse.json({ ok: true, nickname, requests, pending });
}

export async function POST(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "DB 연결을 사용할 수 없습니다." }, { status: 503 });
  }

  let body: { nickname?: string; authHash?: string; featureKeys?: unknown; features?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "요청 형식 오류" }, { status: 400 });
  }

  const rawNick = (body.nickname ?? "").trim().slice(0, 20);
  const nickname = normalizeNickname(rawNick);
  const authHash = (body.authHash ?? "").trim();

  if (!nickname) {
    return NextResponse.json({ ok: false, error: "닉네임이 필요합니다." }, { status: 400 });
  }
  if (!authHash) {
    return NextResponse.json({ ok: false, error: "인증이 필요합니다.", requiresAuth: true }, { status: 401 });
  }
  if (!(await verifyParticipantAuthHash(rawNick, authHash))) {
    return NextResponse.json({ ok: false, error: "인증에 실패했습니다.", requiresAuth: true }, { status: 401 });
  }

  const featureKeys = parseImageEntitlementFeatures(body.featureKeys ?? body.features ?? "both");
  if (featureKeys.length === 0) {
    return NextResponse.json({ ok: false, error: "요청할 기능을 선택해 주세요." }, { status: 400 });
  }

  try {
    const result = await createImageEntitlementRequests(admin, nickname, featureKeys);
    if (result.created.length === 0 && result.skipped.length > 0) {
      return NextResponse.json({
        ok: true,
        created: [],
        skipped: result.skipped,
        message: "이미 승인되었거나 접수 대기 중인 요청입니다.",
      });
    }
    return NextResponse.json({
      ok: true,
      created: result.created,
      skipped: result.skipped,
      message:
        result.created.length > 0
          ? "승인 요청이 접수되었습니다. 관리자 확인·결제 확인 후 반영됩니다."
          : "요청을 처리하지 못했습니다.",
    });
  } catch (e) {
    const msg = String(e);
    return NextResponse.json({ ok: false, error: msg.slice(0, 500) }, { status: 500 });
  }
}
