/** 관리자 화면용: AI 생성 기록 meta를 사람이 읽기 쉬운 줄로 풀어 씀 (사용자에게 노출 금지) */
export function formatAiContentAdminLines(meta: unknown): string[] {
  if (!meta || typeof meta !== "object") return [];
  const m = meta as Record<string, unknown>;
  const lines: string[] = [];

  if (typeof m.source === "string") lines.push(`출처: ${m.source}`);
  if (typeof m.model === "string") lines.push(`모델: ${m.model}`);
  if (typeof m.durationType === "string") lines.push(`찰나: ${m.durationType}`);
  if (typeof m.scope === "string") lines.push(`범위: ${m.scope}`);
  if (m.hasDecisional1s === true) lines.push(`표본/주간에 1s 기록 포함`);
  if (typeof m.reason === "string") lines.push(`사유 코드: ${m.reason}`);
  if (typeof m.geminiFailureKind === "string") {
    lines.push(`Gemini 실패 유형: ${m.geminiFailureKind}`);
    if (m.geminiFailureKind === "local_rate_limit") lines.push(`(서버 측 호출 상한 — GEMINI_RATE_LIMIT_* 환경 변수)`);
    if (m.geminiFailureKind === "http_error" && m.geminiStatus === 404) {
      lines.push(`(404: 모델 ID 오류·종료 — Vercel에 GEMINI_MODEL=gemini-2.5-flash 설정 후 재배포)`);
    }
    if (m.geminiFailureKind === "http_error" && (m.geminiStatus === 400 || m.geminiStatus === 403)) {
      lines.push(`(${m.geminiStatus}: API 키·Generative Language API 활성화·결제 설정 확인)`);
    }
  }
  if (m.geminiAwkwardOutput === true) lines.push(`Gemini 출력이 사용자용 톤 기준에 맞지 않아 대체`);
  if (m.geminiStatus != null) lines.push(`Gemini HTTP: ${String(m.geminiStatus)}`);
  if (typeof m.geminiError === "string" && m.geminiError.trim()) {
    lines.push(`Gemini 오류(발췌): ${m.geminiError.slice(0, 280)}${m.geminiError.length > 280 ? "…" : ""}`);
  }
  if (m.openaiRefineFailed === true) lines.push(`정밀(OpenAI) 단계 실패 → 1차/룰 결과만 사용자에게 전달`);
  if (m.openaiAwkwardOutput === true) lines.push(`OpenAI 출력이 사용자용 톤 기준에 맞지 않아 대체`);
  if (m.openaiEmptyChoice === true) lines.push(`OpenAI 응답 본문 비어 Gemini/룰로 대체 저장`);
  if (m.openaiStatus != null) lines.push(`OpenAI HTTP: ${String(m.openaiStatus)}`);
  if (typeof m.openaiError === "string" && m.openaiError.trim()) {
    lines.push(`OpenAI 오류(발췌): ${m.openaiError.slice(0, 280)}${m.openaiError.length > 280 ? "…" : ""}`);
  }
  if (typeof m.openaiException === "string" && m.openaiException.trim()) {
    lines.push(`예외(발췌): ${m.openaiException.slice(0, 280)}${m.openaiException.length > 280 ? "…" : ""}`);
  }
  const up = m.upstream;
  if (up && typeof up === "object") {
    const u = up as Record<string, unknown>;
    if (typeof u.source === "string") lines.push(`상위 1차: ${u.source}${typeof u.model === "string" ? ` (${u.model})` : ""}`);
  }
  if (typeof m.week === "string") lines.push(`주(week): ${m.week}`);
  if (typeof m.label === "string") lines.push(`주 라벨: ${m.label}`);

  return lines;
}
