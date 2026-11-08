import "server-only";

import { generateText, MODELS } from "@/lib/ai/gemini";
import { OCR_PROMPT } from "@/lib/ai/prompts";

/**
 * OCR for photos and scanned PDF pages (AGENTS.md §12: scanned PDFs have no
 * text layer; handwriting OCR isn't perfect, so the page reference is kept).
 * OCR_PROVIDER=gemini (default when GEMINI_API_KEY is set) | mock.
 */

export type PageImage = { data: Uint8Array; mimeType: string };

export function ocrProvider(): "gemini" | "mock" {
  const p = process.env.OCR_PROVIDER || (process.env.GEMINI_API_KEY ? "gemini" : "mock");
  if (p !== "gemini" && p !== "mock") throw new Error(`OCR provider "${p}" is not supported`);
  return p;
}

export async function ocrPage(image: PageImage | null, page: number): Promise<string> {
  if (ocrProvider() === "mock" || !image) {
    return (
      `[OCR preview] Handwritten notes, page ${page}. ` +
      "Real text recognition is not connected yet, so this page shows placeholder text. " +
      "Open the original file to read this page."
    );
  }
  const text = await generateText({
    model: MODELS.fast,
    // Interactions API (v1): multimodal input goes inside a `user_input` step's `content`.
    input: [
      {
        type: "user_input",
        content: [
          { type: "text", text: OCR_PROMPT },
          { type: "image", data: Buffer.from(image.data).toString("base64"), mime_type: image.mimeType },
        ],
      },
    ],
    maxOutputTokens: 8192,
  });
  return text.trim();
}
