/**
 * Split plain text into parts, marking whole-word, case-insensitive matches of
 * key terms. Longest term wins where terms overlap. Returns data only (no
 * HTML), so document text can never inject markup.
 */
export type TextPart = { text: string; mark: boolean };

export function highlightParts(text: string, terms: string[]): TextPart[] {
  const clean = [...new Set(terms.map((t) => t.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (clean.length === 0 || !text) return [{ text, mark: false }];
  const escaped = clean.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${escaped.join("|")})(?![\\p{L}\\p{N}])`, "giu");

  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start), mark: false });
    parts.push({ text: m[0], mark: true });
    last = start + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), mark: false });
  return parts;
}
