/**
 * Light formatting for chat answers, parsed into plain data (never HTML):
 * paragraphs, bulleted / numbered lists, **bold**, and [n] citations.
 * Shared by server and client; unit-tested.
 */

export type Inline = { kind: "text"; text: string } | { kind: "bold"; text: string } | { kind: "cite"; n: number };

export type Block =
  | { kind: "p"; content: Inline[] }
  | { kind: "ul"; items: Inline[][] }
  | { kind: "ol"; items: Inline[][]; start: number };

const CITE = /\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]/g;

/** "**x** [1]" → inline tokens. Unclosed ** stays as text (mid-stream). */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const pushText = (t: string) => {
    if (!t) return;
    const last = out.at(-1);
    if (last?.kind === "text") last.text += t;
    else out.push({ kind: "text", text: t });
  };
  const parts = text.split(/(\*\*[^*\n]+?\*\*)/g);
  for (const part of parts) {
    if (/^\*\*[^*\n]+?\*\*$/.test(part)) {
      out.push({ kind: "bold", text: part.slice(2, -2) });
      continue;
    }
    let last = 0;
    for (const m of part.matchAll(CITE)) {
      pushText(part.slice(last, m.index));
      for (const n of m[1].split(",").map((x) => Number(x.trim()))) out.push({ kind: "cite", n });
      last = m.index + m[0].length;
    }
    pushText(part.slice(last));
  }
  return out;
}

const BULLET = /^\s*(?:[-*•])\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,3})[.)]\s+(.*)$/;

export function parseAnswer(text: string): Block[] {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/^#{1,6}\s+/, "")); // headings → plain lines
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", content: parseInline(para.join("\n").trim()) });
    para = [];
  };
  for (const line of lines) {
    const b = BULLET.exec(line);
    const n = b ? null : NUMBERED.exec(line);
    if (b || n) {
      flush();
      const item = parseInline((b ? b[1] : n![2]).trim());
      const last = blocks.at(-1);
      if (b && last?.kind === "ul") last.items.push(item);
      else if (n && last?.kind === "ol") last.items.push(item);
      else if (b) blocks.push({ kind: "ul", items: [item] });
      else blocks.push({ kind: "ol", items: [item], start: Number(n![1]) });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    // A line right after a list item continues it (wrapped text), unless blank-separated.
    const last = blocks.at(-1);
    if (!para.length && (last?.kind === "ul" || last?.kind === "ol") && /^\s{2,}/.test(line)) {
      last.items[last.items.length - 1].push({ kind: "text", text: ` ${line.trim()}` });
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks.filter((b) => (b.kind === "p" ? b.content.length > 0 : b.items.length > 0));
}

/** Text to copy: citations become "(p. 3)", bold markers dropped. */
export function plainAnswer(text: string, pageOf: (n: number) => number | undefined): string {
  return text
    .replace(/\*\*([^*\n]+?)\*\*/g, "$1")
    // A run like "[1][2]" becomes one "(p. 3, 5)".
    .replace(/(?:\[\d{1,2}(?:\s*,\s*\d{1,2})*\]\s*)+/g, (run: string) => {
      const pages = [
        ...new Set(
          (run.match(/\d{1,2}/g) ?? [])
            .map((x) => pageOf(Number(x)))
            .filter((p): p is number => p !== undefined),
        ),
      ];
      return pages.length ? ` (p. ${pages.join(", ")})` : "";
    })
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/ {2,}/g, " ")
    .trim();
}
