/**
 * Split page text into small chunks that keep their page number (AGENTS.md §9).
 * A chunk never crosses a page, so every citation points at one exact page.
 */

export type PageText = { page: number; text: string };
export type TextChunk = { page: number; text: string };

export const CHUNK_SIZE = 1000;
export const CHUNK_OVERLAP = 150;

/** Collapse whitespace, re-join words hyphenated across line ends, drop control chars. */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t\f\v\xa0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Last sentence end (or whitespace) in text[from, to), so chunks break cleanly. */
function breakPoint(text: string, from: number, to: number): number {
  const window = text.slice(from, to);
  const minKeep = Math.floor((to - from) * 0.5);
  const sentence = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("? "),
    window.lastIndexOf("! "),
    window.lastIndexOf("\n"),
  );
  if (sentence >= minKeep) return from + sentence + 1;
  const space = window.lastIndexOf(" ");
  if (space >= minKeep) return from + space;
  return to;
}

export function chunkPage(
  { page, text }: PageText,
  size = CHUNK_SIZE,
  overlap = CHUNK_OVERLAP,
): TextChunk[] {
  const clean = normalizeText(text);
  if (!clean) return [];
  if (clean.length <= size) return [{ page, text: clean }];

  const chunks: TextChunk[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = start + size >= clean.length ? clean.length : breakPoint(clean, start, start + size);
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push({ page, text: piece });
    if (end >= clean.length) break;
    // Step back for overlap, then forward to a word start so chunks don't begin mid-word.
    let next = Math.max(end - overlap, start + 1);
    const space = clean.indexOf(" ", next);
    if (space !== -1 && space < end) next = space + 1;
    start = next;
  }
  return chunks;
}

export function chunkPages(pages: PageText[]): TextChunk[] {
  return pages.flatMap((p) => chunkPage(p));
}
