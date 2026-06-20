import { NextRequest, NextResponse } from "next/server";
import { inferResonanceKindFromNote } from "@/lib/inferResonanceKind";
import { isResonanceKindId, resonanceKindShortLabel } from "@/lib/resonanceEssence";
import { isNoteReadyForResonanceSuggest } from "@/lib/resonanceSuggestConfig";
import { getClientIp } from "@/lib/requestIp";

type Body = {
  note?: string;
  durationType?: string;
};

/** 기록 모달 미리보기용 — 저장 전 감응 유형 추천 */
export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "요청 형식 오류" }, { status: 400 });
  }

  const note = (body.note ?? "").trim();
  const durationType =
    body.durationType && ["1s", "10s", "100s"].includes(body.durationType) ? body.durationType : "1s";

  if (!isNoteReadyForResonanceSuggest(note, durationType)) {
    return NextResponse.json({ ok: true, suggested: null, label: null });
  }

  const suggested = await inferResonanceKindFromNote(note, durationType, {
    rateLimitKey: `suggest:${getClientIp(request)}`,
  });

  return NextResponse.json({
    ok: true,
    suggested,
    label: suggested && isResonanceKindId(suggested) ? resonanceKindShortLabel(suggested) : null,
  });
}
