// Plain helpers (no "use client"): the browser strips citations while Vappi
// writes, the server does the same before saving.

const TOKEN = String.raw`(?:\d{1,2}|overview|source)`;
const CITE = new RegExp(String.raw`[ \t]*(?:\[${TOKEN}(?:\s*,\s*${TOKEN})*\])+`, "gi");

/** "[3]" / "[2][5]" / "[overview, 5]" citation markers → removed (pages are listed under "Made from"). */
export const stripCitations = (markdown: string) => markdown.replace(CITE, "");

/** Excerpt ids cited in the text. */
export function citedIds(markdown: string): number[] {
  const ids = new Set<number>();
  for (const m of markdown.matchAll(new RegExp(String.raw`\[(${TOKEN}(?:\s*,\s*${TOKEN})*)\]`, "gi")))
    for (const n of m[1].split(",")) if (/^\d+$/.test(n.trim())) ids.add(Number(n.trim()));
  return [...ids];
}

/** A title from the AI's text: the first "# heading", or an email's "Subject:" line. */
export function titleFrom(markdown: string): string | null {
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    const h = line.match(/^#{1,2}\s+(.+)$/);
    if (h) return h[1].replace(/[*_`]/g, "").trim();
    const s = line.match(/^\**subject:?\**\s*:?\s*(.+)$/i);
    if (s) return s[1].replace(/[*_`]/g, "").trim();
  }
  return null;
}

/**
 * The page shows the title above the document (like the reference), so a
 * leading "# Title" line moves out of the body. Emails keep their Subject line.
 */
export function splitTitle(markdown: string): { title: string | null; body: string } {
  const m = markdown.match(/^\s*#\s+(.+?)\s*(?:\n|$)/);
  if (!m) return { title: null, body: markdown };
  return { title: m[1].replace(/[*_`]/g, "").trim(), body: markdown.slice(m[0].length).replace(/^\s*\n/, "") };
}

/** Removes citation markers from every text node of a saved Tiptap document (older saves kept some). */
export function stripDocCitations<T>(doc: T): T {
  const walk = (node: unknown): unknown => {
    if (!node || typeof node !== "object") return node;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    const out: Record<string, unknown> = { ...n };
    if (n.type === "text" && typeof n.text === "string") out.text = stripCitations(n.text);
    if (Array.isArray(n.content)) {
      out.content = n.content.map(walk).filter((c) => !(c && (c as { type?: string; text?: string }).type === "text" && !(c as { text?: string }).text));
    }
    return out;
  };
  return walk(doc) as T;
}
