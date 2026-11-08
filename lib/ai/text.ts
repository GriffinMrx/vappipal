/**
 * Text helpers for study material: sentences that keep their page, and key
 * terms. Used by the mock generator; pure functions, safe anywhere.
 */

export type Section = { page: number; text: string };
export type Sentence = { page: number; text: string; order: number };

const STOP = new Set(
  (
    "a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its itself just me more most my no nor not now of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your page slide notes speaker however therefore thus example called used use using one two three first second may might must shall within without upon via etc ie eg"
  ).split(" "),
);

/**
 * Where a sentence ends, in any script:
 * - ". ! ?" + space, then a capital, digit, quote, or a letter from a script
 *   without lowercase (Arabic, Hebrew, CJK…), or a non-Latin capital (Cyrillic, Greek);
 * - "؟ ۔ 。 ！ ？" (Arabic, Urdu, CJK), with or without a space after.
 */
const SENTENCE_END = /(?<=[.!?])\s+(?=[A-Z0-9"“(«]|[^\x00-\x7F\p{Ll}\s])|(?<=[؟۔。！？])\s*|\n+/u;
const ENDS_SENTENCE = /[.!?؟۔。！？]$/u;

/** Split each section into sentences (no sentence spans two pages). Works for every script. */
export function splitSentences(sections: Section[]): Sentence[] {
  const out: Sentence[] = [];
  const seen = new Set<string>(); // chunks overlap: the same sentence can appear twice
  let order = 0;
  for (const { page, text } of sections) {
    const parts = text
      .replace(/\s+/g, " ")
      .split(SENTENCE_END)
      .map((s) => s.trim())
      .filter((s) => s.length >= 25 && s.length <= 400 && /\p{L}/u.test(s) && !/^\[OCR preview\]/.test(s));
    for (const t of parts) {
      const key = `${page}:${t.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ page, text: ENDS_SENTENCE.test(t) ? t : `${t}.`, order: order++ });
    }
  }
  return out;
}

/** Letters (any script) across the sections: "is there enough real text here?" */
export function letterCount(sections: Section[]): number {
  let n = 0;
  for (const { text } of sections) n += text.match(/\p{L}/gu)?.length ?? 0;
  return n;
}

export function words(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}][\p{L}\p{N}'-]*/gu) ?? []).filter(
    (w) => w.length > 2 && !STOP.has(w),
  );
}

/**
 * Most characteristic terms: frequent words and two-word phrases, preferring
 * phrases, spread over the document. Returned in their original casing.
 */
export function keyTerms(sentences: Sentence[], max = 12): string[] {
  const counts = new Map<string, number>();
  const sentencesWith = new Map<string, Set<number>>(); // document frequency, per sentence
  const casing = new Map<string, string>();
  for (const s of sentences) {
    const tokens = s.text.match(/[\p{L}][\p{L}\p{N}'-]*/gu) ?? [];
    const bump = (key: string, original: string) => {
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!sentencesWith.has(key)) sentencesWith.set(key, new Set());
      sentencesWith.get(key)!.add(s.order);
      if (!casing.has(key)) casing.set(key, original);
    };
    for (let i = 0; i < tokens.length; i++) {
      const w = tokens[i].toLowerCase();
      if (w.length <= 2 || STOP.has(w)) continue;
      bump(w, tokens[i]);
      const next = tokens[i + 1]?.toLowerCase();
      if (next && next.length > 2 && !STOP.has(next)) bump(`${w} ${next}`, `${tokens[i]} ${tokens[i + 1]}`);
    }
  }
  const n = Math.max(1, sentences.length);
  // tf × idf: frequent here, but not in nearly every sentence ("cell" in a cell-biology course).
  const score = (k: string) => {
    const df = sentencesWith.get(k)!.size;
    return counts.get(k)! * Math.log(1 + n / df) * (k.includes(" ") ? 1.5 : 1);
  };
  const byScore = (keys: string[]) => keys.sort((a, b) => score(b) - score(a) || a.localeCompare(b));
  const all = [...counts.keys()].filter((k) => counts.get(k)! >= 2);

  // Phrases first ("cell membrane" beats "cell"), then single words not inside a chosen phrase.
  const chosen: string[] = [];
  for (const k of byScore(all.filter((k) => k.includes(" ")))) {
    if (chosen.length >= Math.ceil(max / 2)) break;
    if (chosen.some((c) => c.split(" ").some((w) => k.split(" ").includes(w)))) continue;
    chosen.push(k);
  }
  for (const k of byScore(all.filter((k) => !k.includes(" ")))) {
    if (chosen.length >= max) break;
    if (chosen.some((c) => c.split(" ").includes(k))) continue;
    chosen.push(k);
  }
  // Keep acronyms ("RNA") as written; lowercase other words ("Mitochondria" at a sentence start).
  return chosen.map((k) =>
    casing
      .get(k)!
      .split(" ")
      .map((w) => (/^[A-Z0-9]{2,}s?$/.test(w) ? w : w.toLowerCase()))
      .join(" "),
  );
}

/** Deterministic PRNG (mulberry32) seeded from a string, for stable shuffles. */
export function seeded(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Case-insensitive whole-word match of `term` in `text`. */
export function termRegex(term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu");
}
