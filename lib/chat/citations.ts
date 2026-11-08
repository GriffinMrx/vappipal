/** Citation markers like [1] or [2][3] (also "[1, 2]"). Shared by server and client. */
const MARKER = /\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]/g;

/** Numbers cited in `text`, in first-use order. */
export function citedNumbers(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(MARKER)) {
    for (const n of m[1].split(",").map((x) => Number(x.trim()))) if (!out.includes(n)) out.push(n);
  }
  return out;
}

/** Remove markers whose numbers aren't in `valid` (the model invented them). */
export function stripInvalidCitations(text: string, valid: Set<number>): string {
  return text
    .replace(MARKER, (_m, list: string) => {
      const keep = list
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((n) => valid.has(n));
      return keep.map((n) => `[${n}]`).join("");
    })
    .replace(/[ \t]+([.,;:!?])/g, "$1");
}

export type TextPart = { kind: "text"; text: string } | { kind: "cite"; n: number };

/** Split text into plain parts and citation numbers (for rendering links). */
export function splitCitations(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(MARKER)) {
    if (m.index > last) parts.push({ kind: "text", text: text.slice(last, m.index) });
    for (const n of m[1].split(",").map((x) => Number(x.trim()))) parts.push({ kind: "cite", n });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}
