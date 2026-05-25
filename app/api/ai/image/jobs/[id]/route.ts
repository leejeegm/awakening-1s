import { NextRequest, NextResponse } from "next/server";
import { normalizeNickname } from "@/lib/entitlements";
import { verifyParticipantAuthHash } from "@/lib/participantAuth";
import { getServerImageConfig } from "@/lib/serverImageConfig";
import { getServerImageJob, processServerImageJob } from "@/lib/serverImageJob";
import { providerConfigError, resolveImageProvider } from "@/lib/serverImageProvider";

export const maxDuration = 10;

type RouteContext = { params: { id: string } };

export async function GET(request: NextRequest, context: RouteContext) {
  const jobId = (context.params.id ?? "").trim();
  const { searchParams } = new URL(request.url);
  const rawNick = (searchParams.get("nickname") ?? "").trim().slice(0, 20);
  const nickname = normalizeNickname(searchParams.get("nickname") ?? "");
  const authHash = (searchParams.get("authHash") ?? "").trim();

  if (!jobId) return NextResponse.json({ error: "jobId가 필요합니다." }, { status: 400 });
  if (!nickname) return NextResponse.json({ error: "닉네임이 필요합니다." }, { status: 400 });
  if (!authHash) {
    return NextResponse.json({ error: "인증이 필요합니다.", requiresAuth: true }, { status: 401 });
  }
  const authed = await verifyParticipantAuthHash(rawNick, authHash);
  if (!authed) {
    return NextResponse.json({ error: "인증에 실패했습니다.", requiresAuth: true }, { status: 401 });
  }

  const provider = resolveImageProvider();
  const providerErr = providerConfigError(provider);
  if (providerErr) {
    return NextResponse.json({ error: providerErr, provider }, { status: 503 });
  }
  const engineUrl = (process.env.IMAGE_ENGINE_URL ?? "").trim() || undefined;

  const job = await getServerImageJob(jobId, nickname);
  if (!job) return NextResponse.json({ error: "작업을 찾을 수 없습니다." }, { status: 404 });

  const cfg = getServerImageConfig();
  const outcome = await processServerImageJob({ job, provider, engineUrl, nickname });

  if (outcome.status === "done") {
    return NextResponse.json({
      jobId,
      provider,
      status: "done",
      cached: "cached" in outcome ? outcome.cached : false,
      url: outcome.url ?? null,
      imageBase64: "imageBase64" in outcome ? outcome.imageBase64 : null,
      width: outcome.width,
      height: outcome.height,
      steps: "steps" in outcome ? outcome.steps : job.steps,
      storageWarning: "storageWarning" in outcome ? outcome.storageWarning : undefined,
      usage: "usage" in outcome ? outcome.usage : undefined,
    });
  }

  if (outcome.status === "failed") {
    return NextResponse.json({
      jobId,
      provider,
      status: "failed",
      error: outcome.error,
      timedOut: "timedOut" in outcome ? outcome.timedOut : false,
      pollIntervalMs: cfg.pollIntervalMs,
    });
  }

  return NextResponse.json({
    jobId,
    provider,
    status: "running",
    pollIntervalMs: cfg.pollIntervalMs,
    pollMaxMs: cfg.pollMaxMs,
  });
}
