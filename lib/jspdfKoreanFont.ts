import fs from "fs";
import path from "path";

const FONT_REGULAR_FILE = "NanumGothic-Regular.ttf";
const FONT_BOLD_FILE = "NanumGothic-Bold.ttf";
export const KOREAN_PDF_FONT = "NanumGothic";

let vfsRegistered = false;

function fontsDir() {
  return path.join(process.cwd(), "assets", "fonts");
}

function readFontBase64(fileName: string): string {
  const filePath = path.join(fontsDir(), fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `한글 PDF 폰트가 없습니다: ${filePath}\n` +
        "assets/fonts/NanumGothic-Regular.ttf · NanumGothic-Bold.ttf 가 필요합니다."
    );
  }
  const buf = fs.readFileSync(filePath);
  if (buf.length < 10_000) {
    throw new Error(`한글 PDF 폰트 파일이 손상되었거나 비어 있습니다: ${filePath}`);
  }
  return buf.toString("base64");
}

/** jsPDF VFS에 나눔고딕 등록 (프로세스당 1회) */
export function registerKoreanPdfFonts(doc: import("jspdf").jsPDF) {
  if (vfsRegistered) return;

  const regularB64 = readFontBase64(FONT_REGULAR_FILE);
  doc.addFileToVFS(FONT_REGULAR_FILE, regularB64);
  doc.addFont(FONT_REGULAR_FILE, KOREAN_PDF_FONT, "normal");

  const boldPath = path.join(fontsDir(), FONT_BOLD_FILE);
  if (fs.existsSync(boldPath)) {
    const boldB64 = readFontBase64(FONT_BOLD_FILE);
    doc.addFileToVFS(FONT_BOLD_FILE, boldB64);
    doc.addFont(FONT_BOLD_FILE, KOREAN_PDF_FONT, "bold");
  }

  vfsRegistered = true;
}

export function setKoreanPdfFont(doc: import("jspdf").jsPDF, style: "normal" | "bold" = "normal") {
  registerKoreanPdfFonts(doc);
  doc.setFont(KOREAN_PDF_FONT, style);
}
