// Server-side safety net for Vappi's edits (prompt 49): the model first lists what
// the request asks for that is in NONE of the user's files ("notInFiles"); any
// change that still writes about those things is dropped, so nothing outside the
// files reaches the page even when the model slips. No imports: easy to test.

type TextOp = { op: string; markdown?: string; replace?: string; title?: string };

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/** Words (3+ letters) of a "not in files" item, e.g. "swimming drills" → ["swimming", "drills"]. */
function keyWords(item: string): string[] {
  return norm(item)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3);
}

/**
 * Drops ops whose new text mentions something from `notInFiles` that the page
 * didn't already contain (so rewording existing text is never blocked).
 * Returns the kept ops and the items that were actually blocked.
 */
export function guardOps<T extends TextOp>(ops: T[], notInFiles: string[], pageText: string): { ops: T[]; blocked: string[] } {
  const page = norm(pageText);
  // Only the most specific word of each item matters ("swimming", not "drills" or "day").
  const items = notInFiles
    .map((item) => {
      const fresh = keyWords(item).filter((w) => !page.includes(w));
      const longest = fresh.sort((a, b) => b.length - a.length)[0];
      return { item, words: longest && longest.length >= 4 ? [longest] : [] };
    })
    .filter((x) => x.words.length > 0);
  if (items.length === 0) return { ops, blocked: [] };
  const blocked = new Set<string>();
  const kept = ops.filter((o) => {
    const text = norm(`${o.markdown ?? ""} ${o.replace ?? ""} ${o.title ?? ""}`);
    const hit = items.find((x) => x.words.some((w) => new RegExp(`(^|[^\\p{L}])${w}`, "u").test(text)));
    if (hit) blocked.add(hit.item);
    return !hit;
  });
  return { ops: kept, blocked: [...blocked] };
}
