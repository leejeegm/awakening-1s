import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookie } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { buildPremiumReportPdfBuffer } from "@/lib/premiumReportPdf";
import { mergePdfBuffers } from "@/lib/premiumReportPdfMerge";
import { createSignedPremiumReportUrl, loadPremiumReportPdfAssets, uploadPremiumReportPdf } from "@/lib/premiumReportStorage";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await verifyAdminCookie())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "서버 설정 오류" }, { status: 503 });

  const { data: requestRow, error: requestError } = await admin
    .from("premium_report_requests")
    .select("id, nickname, requested_at")
    .eq("id", params.id)
    .maybeSingle();

  if (requestError || !requestRow) {
    return NextResponse.json({ error: "신청을 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: latestDocument, error: docError } = await admin
    .from("premium_report_documents")
    .select("*")
    .eq("request_id", params.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (docError || !latestDocument) {
    return NextResponse.json({ error: "발행할 문서가 없습니다. 먼저 문서를 저장해주세요." }, { status: 404 });
  }

  const doc = latestDocument as {
    id: string;
    version: number;
    title: string;
    summary_text: string | null;
    sections_json: unknown;
    page_count: number;
  };

  await admin
    .from("premium_report_documents")
    .update({ pdf_status: "generating", updated_by: "admin" } as never)
    .eq("id", doc.id);

  try {
    const { imageAssets, attachmentPdfs } = await loadPremiumReportPdfAssets(params.id);
    const pdf = await buildPremiumReportPdfBuffer({
      title: doc.title,
      nickname: (requestRow as { nickname: string }).nickname,
      requestedAt: (requestRow as { requested_at: string | null }).requested_at,
      summaryText: doc.summary_text,
      pageCount: doc.page_count,
      sections: Array.isArray(doc.sections_json)
        ? (doc.sections_json as { key?: string; title?: string; body?: string }[])
        : [],
      imageAssets,
      attachmentPdfs,
    });
    const mergedPdf = await mergePdfBuffers(
      pdf,
      attachmentPdfs.map((asset) => asset.pdfBuffer)
    );

    const uploaded = await uploadPremiumReportPdf({
      nickname: (requestRow as { nickname: string }).nickname,
      requestId: params.id,
      version: doc.version,
      pdf: mergedPdf,
    });

    if (!uploaded.ok) {
      await admin
        .from("premium_report_documents")
        .update({ pdf_status: "failed", updated_by: "admin" } as never)
        .eq("id", doc.id);
      return NextResponse.json({ error: uploaded.error }, { status: 500 });
    }

    const meta = {
      version: doc.version,
      bytes: mergedPdf.byteLength,
      generated_at: new Date().toISOString(),
      image_asset_count: imageAssets.length,
      attachment_pdf_count: attachmentPdfs.length,
    };

    const { error: assetError } = await admin.from("premium_report_assets").insert({
      request_id: params.id,
      asset_type: "final_pdf",
      storage_bucket: uploaded.bucket,
      storage_path: uploaded.path,
      mime_type: "application/pdf",
      meta_json: meta,
    } as never);

    if (assetError) {
      await admin
        .from("premium_report_documents")
        .update({ pdf_status: "failed", updated_by: "admin" } as never)
        .eq("id", doc.id);
      return NextResponse.json({ error: assetError.message }, { status: 500 });
    }

    await admin
      .from("premium_report_documents")
      .update({ pdf_status: "ready", updated_by: "admin" } as never)
      .eq("id", doc.id);

    await admin.from("premium_report_actions").insert({
      request_id: params.id,
      action: "pdf_published",
      actor: "admin",
      meta_json: meta,
    } as never);

    const signedUrl = await createSignedPremiumReportUrl(uploaded.bucket, uploaded.path, 60 * 10);
    return NextResponse.json({
      ok: true,
      asset: {
        asset_type: "final_pdf",
        storage_bucket: uploaded.bucket,
        storage_path: uploaded.path,
        mime_type: "application/pdf",
        download_url: signedUrl,
      },
    });
  } catch (error) {
    await admin
      .from("premium_report_documents")
      .update({ pdf_status: "failed", updated_by: "admin" } as never)
      .eq("id", doc.id);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PDF 발행 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
