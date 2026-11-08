/** One page (or slide) of a document. `needsOcr` = no usable text layer. */
export type ExtractedPage = { page: number; text: string; needsOcr?: boolean };

/** A loaded document that can hand out its pages in batches (1-based, inclusive). */
export type Extractor = {
  pageCount: number;
  pages(from: number, to: number): Promise<ExtractedPage[]>;
  /** An image of one page, for OCR (scanned PDF pages, photos). */
  pageImage?(page: number): Promise<{ data: Uint8Array; mimeType: string } | null>;
};

/** A failure the user can understand and maybe fix. Its message is shown as-is. */
export class ExtractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractError";
  }
}
