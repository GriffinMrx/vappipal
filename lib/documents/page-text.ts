// Plain module: rebuild each page's text from its stored chunks (prompt 38).
// Chunks on one page overlap by up to CHUNK_OVERLAP characters; the overlap is removed.

export type PageTextView = { page: number; text: string };

export function pagesFromChunks(chunks: { page: number; index: number; text: string }[]): PageTextView[] {
  const byPage = new Map<number, string>();
  for (const c of [...chunks].sort((a, b) => a.index - b.index)) {
    const prev = byPage.get(c.page);
    if (prev === undefined) {
      byPage.set(c.page, c.text);
      continue;
    }
    let cut = 0;
    for (let n = Math.min(300, prev.length, c.text.length); n >= 20; n--) {
      if (prev.endsWith(c.text.slice(0, n))) {
        cut = n;
        break;
      }
    }
    byPage.set(c.page, `${prev}${cut ? "" : "\n"}${c.text.slice(cut)}`);
  }
  return [...byPage.entries()].sort((a, b) => a[0] - b[0]).map(([page, text]) => ({ page, text }));
}
