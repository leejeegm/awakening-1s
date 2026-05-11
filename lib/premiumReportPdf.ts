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

export async function buildPremiumReportPdfBuffer(args: PremiumReportPdfArgs) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageW - margin * 2;
  const lineH = 6.5;
  let y = 20;

  const ensureSpace = (needed = 20) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = 20;
    }
  };

  const addTextBlock = (text: string, size = 11) => {
    if (!text.trim()) return;
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, contentW);
    ensureSpace(lineH * (lines.length + 1));
    doc.text(lines, margin, y);
    y += lineH * (lines.length + 1);
  };

  const addImageBlock = (asset: PremiumReportImageAsset, maxHeight: number) => {
    const caption = [asset.title, asset.originalName].filter(Boolean).join(" · ");
    if (caption) {
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(caption, contentW);
      ensureSpace(lineH * (lines.length + 1) + maxHeight + 10);
      doc.text(lines, margin, y);
      y += lineH * (lines.length + 0.5);
    } else {
      ensureSpace(maxHeight + 10);
    }

    if (asset.description?.trim()) {
      addTextBlock(asset.description, 10);
    }

    try {
      const props = doc.getImageProperties(asset.dataUrl);
      const rawWidth = Number(props.width) || 1;
      const rawHeight = Number(props.height) || 1;
      const maxWidth = contentW;
      const scale = Math.min(maxWidth / rawWidth, maxHeight / rawHeight);
      const width = Math.max(40, rawWidth * scale);
      const height = Math.max(30, rawHeight * scale);
      ensureSpace(height + 8);
      doc.addImage(asset.dataUrl, toPdfImageFormat(asset.mimeType), margin, y, width, height);
      y += height + 10;
    } catch {
      addTextBlock("이미지 렌더링에 실패한 자산이 있어 본문에는 텍스트만 남겼습니다.", 10);
    }
  };

  doc.setFontSize(16);
  doc.text(args.title || "나의 자깨 감응 보고서", margin, y);
  y += 12;

  doc.setFontSize(11);
  doc.text(`닉네임: ${args.nickname}`, margin, y);
  y += 7;
  if (args.requestedAt) {
    doc.text(`신청일: ${new Date(args.requestedAt).toLocaleString("ko-KR")}`, margin, y);
    y += 7;
  }
  if (args.pageCount) {
    doc.text(`설정 페이지 수: ${args.pageCount}`, margin, y);
    y += 10;
  } else {
    y += 6;
  }

  if (args.summaryText?.trim()) {
    doc.setFontSize(12);
    doc.text("핵심 요약", margin, y);
    y += 8;
    addTextBlock(args.summaryText, 11);
  }

  const imageAssets = args.imageAssets ?? [];
  const coverImage = imageAssets.find((asset) => asset.isCover) ?? imageAssets[0] ?? null;
  const remainingImages = coverImage ? imageAssets.filter((asset) => asset !== coverImage) : imageAssets;

  if (coverImage) {
    ensureSpace(32);
    doc.setFontSize(12);
    doc.text("대표 시각 자료", margin, y);
    y += 8;
    addImageBlock(coverImage, 120);
  }

  for (const section of args.sections ?? []) {
    const title = (section.title ?? "").trim();
    const body = (section.body ?? "").trim();
    if (!title && !body) continue;
    ensureSpace(18);
    if (title) {
      doc.setFontSize(12);
      doc.text(title, margin, y);
      y += 8;
    }
    if (body) addTextBlock(body, 11);
  }

  if (remainingImages.length > 0) {
    ensureSpace(24);
    doc.setFontSize(12);
    doc.text("시각 자료", margin, y);
    y += 8;

    for (const asset of remainingImages) {
      addImageBlock(asset, 110);
    }
  }

  const attachmentPdfs = args.attachmentPdfs ?? [];
  if (attachmentPdfs.length > 0) {
    ensureSpace(22);
    doc.setFontSize(12);
    doc.text("참고 첨부 자료", margin, y);
    y += 8;
    addTextBlock(
      attachmentPdfs
        .map((asset, index) => {
          const title = asset.title || asset.originalName || "첨부 PDF";
          return `${index + 1}. ${title}${asset.description ? ` - ${asset.description}` : ""}`;
        })
        .join("\n"),
      10
    );
  }

  return Buffer.from(doc.output("arraybuffer"));
}
