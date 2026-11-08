import "server-only";

import type { FileType } from "@/lib/generated/prisma/enums";
import { docxExtractor, pptxExtractor } from "./office";
import { ocrPage } from "./ocr";
import { pdfExtractor } from "./pdf";
import type { ExtractedPage, Extractor } from "./types";

export { ExtractError } from "./types";
export type { ExtractedPage, Extractor } from "./types";

/** Open a file for page-by-page extraction (PARSER=llamaparse later swaps PPTX/DOCX/scans). */
export async function openDocument(bytes: Uint8Array, fileType: FileType, mimeType = ""): Promise<Extractor> {
  switch (fileType) {
    case "PDF":
      return pdfExtractor(bytes);
    case "PPTX":
      return pptxExtractor(bytes);
    case "DOCX":
      return docxExtractor(bytes);
    case "IMAGE":
      return {
        pageCount: 1,
        pages: async () => [{ page: 1, text: "", needsOcr: true }],
        pageImage: async () => ({ data: bytes, mimeType: mimeType || "image/jpeg" }),
      };
  }
}

/** Fill in OCR text for pages without a usable text layer. Returns whether OCR was used. */
export async function withOcr(
  pages: ExtractedPage[],
  extractor: Pick<Extractor, "pageImage">,
): Promise<{ pages: ExtractedPage[]; ocrUsed: boolean }> {
  let ocrUsed = false;
  const out: ExtractedPage[] = [];
  for (const p of pages) {
    if (p.needsOcr) {
      ocrUsed = true;
      const image = extractor.pageImage ? await extractor.pageImage(p.page) : null;
      // Keep the page's own text if OCR finds nothing, or (no real OCR / no image)
      // gives only its placeholder while the page already had real text.
      const ocr = await ocrPage(image, p.page);
      const hadText = p.text.replace(/\s+/g, "").length >= 20;
      const text = !ocr || (hadText && ocr.startsWith("[OCR preview]")) ? p.text : ocr;
      out.push({ page: p.page, text });
    } else out.push(p);
  }
  return { pages: out, ocrUsed };
}
