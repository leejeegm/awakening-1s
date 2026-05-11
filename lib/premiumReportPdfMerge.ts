export async function mergePdfBuffers(basePdf: Buffer, attachments: Array<Buffer | undefined | null>) {
  const validAttachments = attachments.filter((item): item is Buffer => {
    return item != null && item.byteLength > 0;
  });
  if (validAttachments.length === 0) return basePdf;

  const { PDFDocument } = await import("pdf-lib");
  const merged = await PDFDocument.create();

  const baseDoc = await PDFDocument.load(basePdf);
  const basePages = await merged.copyPages(baseDoc, baseDoc.getPageIndices());
  for (const page of basePages) merged.addPage(page);

  for (const attachment of validAttachments) {
    try {
      const attachmentDoc = await PDFDocument.load(attachment);
      const pages = await merged.copyPages(attachmentDoc, attachmentDoc.getPageIndices());
      for (const page of pages) merged.addPage(page);
    } catch {
      continue;
    }
  }

  const bytes = await merged.save();
  return Buffer.from(bytes);
}
