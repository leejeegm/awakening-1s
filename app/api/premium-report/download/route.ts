import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyParticipantAuthHash } from "@/lib/participantAuth";
import { normalizeNickname, isFeatureEnabledForNickname } from "@/lib/entitlements";
import { buildPremiumReportPdfBuffer } from "@/lib/premiumReportPdf";
import { mergePdfBuffers } from "@/lib/premiumReportPdfMerge";
import { loadPremiumReportPdfAssets } from "@/lib/premiumReportStorage";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = (searchParams.get("id") ?? "").trim();
  const rawNickname = (searchParams.get("nickname") ?? "").trim().slice(0, 20);
  const nickname = normalizeNickname(rawNickname);
  const authHash = (searchParams.get("authHash") ?? "").trim();

  if (!id || !nickname || !rawNickname) {
    return NextResponse.json({ error: "id와 nickname이 필요합니다." }, { status: 400 });
  }
  if (!authHash) {
    return NextResponse.json({ error: "인증이 필요합니다.", requiresAuth: true }, { status: 401 });
  }

  const ok = await verifyParticipantAuthHash(rawNickname, authHash);
  if (!ok) {
    return NextResponse.json({ error: "인증에 실패했습니다.", requiresAuth: true }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "DB 연결을 사용할 수 없습니다." }, { status: 503 });
  }

  const { data: reqRow, error: reqErr } = await admin
    .from("premium_report_requests")
    .select("id, nickname, status, downloadable")
    .eq("id", id)
    .eq("nickname", nickname)
    .maybeSingle();

  if (reqErr || !reqRow) {
    return NextResponse.json({ error: "신청 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  if ((reqRow as { status: string }).status !== "ready" || !(reqRow as { downloadable: boolean }).downloadable) {
    return NextResponse.json({ error: "아직 다운로드할 수 없습니다." }, { status: 403 });
  }

  const entitlement = await isFeatureEnabledForNickname(nickname, "premium_report_download");
  if (!entitlement.ok) {
    return NextResponse.json({ error: "다운로드 권한이 아직 활성화되지 않았습니다." }, { status: 403 });
  }

  const { data: asset } = await admin
    .from("premium_report_assets")
    .select("storage_bucket, storage_path, mime_type")
    .eq("request_id", id)
    .eq("asset_type", "final_pdf")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!asset) {
    const { data: document } = await admin
      .from("premium_report_documents")
      .select("title, summary_text, sections_json, page_count")
      .eq("request_id", id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!document) {
      return NextResponse.json({ error: "최종 PDF가 아직 준비되지 않았습니다." }, { status: 404 });
    }

    const { imageAssets, attachmentPdfs } = await loadPremiumReportPdfAssets(id);
    const pdf = await buildPremiumReportPdfBuffer({
      title: (document as { title: string }).title,
      nickname: rawNickname,
      summaryText: (document as { summary_text: string | null }).summary_text,
      pageCount: (document as { page_count: number }).page_count,
      sections: Array.isArray((document as { sections_json: unknown }).sections_json)
        ? ((document as { sections_json: unknown[] }).sections_json as {
            key?: string;
            title?: string;
            body?: string;
          }[])
        : [],
      imageAssets,
      attachmentPdfs,
    });
    const mergedPdf = await mergePdfBuffers(
      pdf,
      attachmentPdfs.map((asset) => asset.pdfBuffer)
    );

    return new NextResponse(new Uint8Array(mergedPdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="premium-report-${rawNickname}-${id}.pdf"`,
      },
    });
  }

  const bucket = (asset as { storage_bucket: string | null }).storage_bucket;
  const path = (asset as { storage_path: string | null }).storage_path;
  if (!bucket || !path) {
    return NextResponse.json({ error: "다운로드 파일 경로가 비어 있습니다." }, { status: 500 });
  }

  const signed = await admin.storage.from(bucket).createSignedUrl(path, 60 * 5);
  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json({ error: signed.error?.message ?? "다운로드 URL 생성 실패" }, { status: 500 });
  }

  return NextResponse.redirect(signed.data.signedUrl);
}
