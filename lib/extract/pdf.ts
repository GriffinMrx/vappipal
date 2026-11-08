import "server-only";

import { PasswordException, PDFParse } from "pdf-parse";
import { ExtractError, type Extractor } from "./types";

function wrapError(err: unknown): never {
  if (err instanceof PasswordException) {
    throw new ExtractError("This PDF is password-protected. Remove the password and upload it again.");
  }
  if (err instanceof ExtractError) throw err;
  const name = (err as Error)?.name ?? "";
  if (/InvalidPDF|FormatError/i.test(name)) {
    throw new ExtractError("Couldn't read this file. It may be damaged. Try exporting it as PDF again.");
  }
  throw err;
}

/**
 * Some PDFs store Arabic as presentation-form glyphs (U+FB50–FDFF, U+FE70–FEFF)
 * in visual order, so the extracted words come out shaped and reversed. When
 * that is 30%+ of a page's letters, the text layer isn't usable as it is.
 */
const SHAPED_RUN = /[\uFB50-\uFDFF\uFE70-\uFEFF]+/g;

export function isPresentationFormText(text: string): boolean {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  if (letters < 20) return false;
  const shaped = text.match(/[\uFB50-\uFDFF\uFE70-\uFEFF]/g)?.length ?? 0;
  return shaped / letters >= 0.3;
}

/** Real text extraction with pdf-parse, page by page. Pages without text are flagged for OCR. */
export async function pdfExtractor(bytes: Uint8Array): Promise<Extractor> {
  let total = 0;
  const open = () => new PDFParse({ data: bytes.slice() }); // pdf.js detaches its buffer
  const parser = open();
  try {
    total = (await parser.getInfo()).total;
  } catch (err) {
    wrapError(err);
  } finally {
    await parser.destroy().catch(() => {});
  }
  if (!total) throw new ExtractError("This PDF has no pages.");

  return {
    pageCount: total,
    async pages(from, to) {
      const p = open();
      try {
        const res = await p.getText({ first: from, last: to });
        const byNum = new Map(res.pages.map((pg) => [pg.num, pg.text]));
        return Array.from({ length: to - from + 1 }, (_, i) => {
          const page = from + i;
          const raw = byNum.get(page) ?? "";
          // Scanned page: (almost) no text layer → OCR instead of saving an empty page.
          // Garbled layer (Arabic shaped glyphs in visual order) → OCR reads it properly.
          const needsOcr = raw.replace(/\s+/g, "").length < 20 || isPresentationFormText(raw);
          // Shaped glyphs back to normal letters (the fallback if OCR can't run). Only those
          // ranges: NFKC on everything would also turn x² into x2.
          return { page, text: raw.replace(SHAPED_RUN, (m) => m.normalize("NFKC")), needsOcr };
        });
      } catch (err) {
        wrapError(err);
      } finally {
        await p.destroy().catch(() => {});
      }
    },
    /** Render one page to PNG (~1600 px wide) for OCR. Null if rendering isn't available. */
    async pageImage(page) {
      const p = open();
      try {
        const shot = await p.getScreenshot({ partial: [page], desiredWidth: 1600, imageDataUrl: false, imageBuffer: true });
        const data = shot.pages[0]?.data;
        return data && data.length ? { data, mimeType: "image/png" } : null;
      } catch (err) {
        console.error("PDF page render failed", err instanceof Error ? err.name : "error");
        return null;
      } finally {
        await p.destroy().catch(() => {});
      }
    },
  };
}
