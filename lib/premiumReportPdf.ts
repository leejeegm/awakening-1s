type PremiumReportSection = {
  key?: string;
  title?: string;
  body?: string;
};

type PremiumReportImageAsset = {
  title: string;
  originalName?: string | null;
  description?: string | null;
  mimeType: string;
  dataUrl: string;
  isCover?: boolean;
};

type PremiumReportAttachment = {
  title: string;
  originalName?: string | null;
  description?: string | null;
};

const COLORS = {
  deepViolet: [76, 29, 149] as [number, number, number],
  electricBlue: [37, 99, 235] as [number, number, number],
  ink: [15, 23, 42] as [number, number, number],
  slate: [71, 85, 105] as [number, number, number],
  mist: [148, 163, 184] as [number, number, number],
  paper: [248, 250, 252] as [number, number, number],
  gold: [180, 142, 87] as [number, number, number],
};

function toPdfImageFormat(mimeType: string) {
  const lower = mimeType.toLowerCase();
  if (lower === "image/png") return "PNG";
  if (lower === "image/webp") return "WEBP";
  return "JPEG";
}

type PremiumReportPdfArgs = {
  title: string;
  nickname: string;
  requestedAt?: string | null;
  summaryText?: string | null;
  pageCount?: number;
  sections?: PremiumReportSection[];
  imageAssets?: PremiumReportImageAsset[];
  attachmentPdfs?: PremiumReportAttachment[];
};

type PdfDoc = import("jspdf").jsPDF;

function drawPageFooter(doc: PdfDoc, pageNum: number, totalHint: number, margin: number, pageW: number, pageH: number) {
  doc.setDrawColor(...COLORS.mist);
  doc.setLineWidth(0.2);
  doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.mist);
  doc.text("나의 자깨 감응 보고서 · Resonans", margin, pageH - 8);
  doc.text(`${pageNum}${totalHint > 0 ? "" : ""}`, pageW - margin, pageH - 8, { align: "right" });
}

function drawSectionTitle(doc: PdfDoc, title: string, margin: number, y: number, contentW: number) {
  doc.setFillColor(...COLORS.deepViolet);
  doc.rect(margin, y - 1, 3, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.ink);
  doc.text(title, margin + 6, y + 5);
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.35);
  doc.line(margin, y + 9, margin + contentW * 0.35, y + 9);
  return y + 14;
}

export async function buildPremiumReportPdfBuffer(args: PremiumReportPdfArgs) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;
  const lineH = 6.2;
  let y = 0;
  let pageNum = 1;

  const addPage = () => {
    drawPageFooter(doc, pageNum, 0, margin, pageW, pageH);
    doc.addPage();
    pageNum += 1;
    doc.setFillColor(...COLORS.paper);
    doc.rect(0, 0, pageW, pageH, "F");
    y = 22;
  };

  const ensureSpace = (needed = 24) => {
    if (y + needed > pageH - 20) addPage();
  };

  const addBodyText = (text: string, size = 10.5, color: [number, number, number] = COLORS.slate) => {
    if (!text.trim()) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, contentW);
    ensureSpace(lineH * (lines.length + 1));
    doc.text(lines, margin, y);
    y += lineH * lines.length + 2;
  };

  const addImageBlock = (asset: PremiumReportImageAsset, maxHeight: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.ink);
    const caption = asset.title?.trim() || asset.originalName?.trim() || "시각 자료";
    ensureSpace(12);
    doc.text(caption, margin, y);
    y += 5;

    if (asset.description?.trim()) {
      addBodyText(asset.description, 9.5, COLORS.mist);
    }

    try {
      const props = doc.getImageProperties(asset.dataUrl);
      const rawWidth = Number(props.width) || 1;
      const rawHeight = Number(props.height) || 1;
      const scale = Math.min(contentW / rawWidth, maxHeight / rawHeight);
      const width = Math.max(48, rawWidth * scale);
      const height = Math.max(36, rawHeight * scale);
      ensureSpace(height + 10);
      doc.setDrawColor(...COLORS.mist);
      doc.setLineWidth(0.25);
      doc.roundedRect(margin - 1, y - 1, width + 2, height + 2, 2, 2, "S");
      doc.addImage(asset.dataUrl, toPdfImageFormat(asset.mimeType), margin, y, width, height);
      y += height + 12;
    } catch {
      addBodyText("이미지를 PDF에 넣지 못했습니다. 관리자 화면에서 파일 형식을 확인해 주세요.", 9.5, COLORS.mist);
    }
  };

  // —— 표지 ——
  doc.setFillColor(...COLORS.deepViolet);
  doc.rect(0, 0, pageW, 52, "F");
  doc.setFillColor(...COLORS.electricBlue);
  doc.rect(0, 48, pageW, 4, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(220, 225, 255);
  doc.text("PREMIUM AWAKENING RESONANCE REPORT", margin, 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  const titleLines = doc.splitTextToSize(args.title || "나의 자깨 감응 보고서", contentW);
  doc.text(titleLines, margin, 30);

  y = 62;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.ink);
  doc.text(`닉네임  ${args.nickname}`, margin, y);
  y += 7;
  if (args.requestedAt) {
    doc.setTextColor(...COLORS.slate);
    doc.text(`신청일  ${new Date(args.requestedAt).toLocaleString("ko-KR")}`, margin, y);
    y += 7;
  }
  if (args.pageCount) {
    doc.text(`설계 분량  ${args.pageCount}페이지`, margin, y);
    y += 10;
  } else {
    y += 6;
  }

  const imageAssets = args.imageAssets ?? [];
  const coverImage = imageAssets.find((asset) => asset.isCover) ?? imageAssets[0] ?? null;
  const remainingImages = coverImage ? imageAssets.filter((asset) => asset !== coverImage) : imageAssets;

  if (args.summaryText?.trim()) {
    y = drawSectionTitle(doc, "핵심 요약", margin, y, contentW);
    doc.setFillColor(245, 247, 255);
    const summaryLines = doc.splitTextToSize(args.summaryText.trim(), contentW - 8);
    const boxH = Math.max(28, lineH * summaryLines.length + 10);
    ensureSpace(boxH + 4);
    doc.roundedRect(margin, y - 2, contentW, boxH, 3, 3, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.ink);
    doc.text(summaryLines, margin + 4, y + 6);
    y += boxH + 8;
  }

  if (coverImage) {
    y = drawSectionTitle(doc, "대표 시각", margin, y, contentW);
    addImageBlock(coverImage, 105);
  }

  for (const section of args.sections ?? []) {
    const title = (section.title ?? "").trim();
    const body = (section.body ?? "").trim();
    if (!title && !body) continue;
    ensureSpace(28);
    if (title) y = drawSectionTitle(doc, title, margin, y, contentW);
    if (body) addBodyText(body, 10.5, COLORS.slate);
    y += 4;
  }

  if (remainingImages.length > 0) {
    ensureSpace(20);
    y = drawSectionTitle(doc, "시각 자료", margin, y, contentW);
    for (const asset of remainingImages) {
      addImageBlock(asset, 95);
    }
  }

  const attachmentPdfs = args.attachmentPdfs ?? [];
  if (attachmentPdfs.length > 0) {
    ensureSpace(22);
    y = drawSectionTitle(doc, "참고 첨부", margin, y, contentW);
    addBodyText(
      attachmentPdfs
        .map((asset, index) => {
          const title = asset.title || asset.originalName || "첨부 PDF";
          return `${index + 1}. ${title}${asset.description ? ` — ${asset.description}` : ""}`;
        })
        .join("\n"),
      10,
      COLORS.slate
    );
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawPageFooter(doc, p, totalPages, margin, pageW, pageH);
  }

  return Buffer.from(doc.output("arraybuffer"));
}
