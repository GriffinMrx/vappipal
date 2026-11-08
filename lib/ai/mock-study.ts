import type { FlashcardOutput, QuestionOutput, SectionSummaryOutput, SummaryOutput } from "./schemas";
import { keyTerms, seeded, shuffle, splitSentences, termRegex, words, type Section, type Sentence } from "./text";

/**
 * MOCK study-material generator (AGENTS.md §7 project decision: AI mocked for
 * now). Deterministic and grounded: it only rearranges the user's own
 * sentences, so every card/question carries the real page it came from.
 * Same signatures as the real provider in ./study.ts.
 */

function scoreSentences(sentences: Sentence[], terms: string[]) {
  const termRes = terms.map((t, i) => ({ re: termRegex(t), weight: terms.length - i }));
  return sentences.map((s) => {
    const hits = termRes.reduce((sum, t) => sum + (t.re.test(s.text) ? t.weight : 0), 0);
    const lengthFit = s.text.length >= 60 && s.text.length <= 250 ? 1 : 0.6;
    return { s, score: hits * lengthFit };
  });
}

/** Map step: key points of one section. */
export function mockSummarizeSection(sections: Section[]): SectionSummaryOutput {
  const sentences = splitSentences(sections);
  const terms = keyTerms(sentences, 12);
  const want = Math.max(1, Math.min(30, Math.ceil(sections.length / 2) + 2));
  const top = scoreSentences(sentences, terms)
    .sort((a, b) => b.score - a.score || a.s.order - b.s.order)
    .slice(0, want)
    .sort((a, b) => a.s.order - b.s.order);
  return { points: top.map(({ s }) => ({ text: s.text, page: s.page })), keyTerms: terms };
}

/** Reduce step: merge section summaries into the document summary. */
export function mockMergeSummaries(parts: SectionSummaryOutput[]): SummaryOutput {
  const points = parts.flatMap((p) => p.points);
  // Terms that several sections agree on first.
  const tally = new Map<string, number>();
  for (const p of parts) p.keyTerms.forEach((t, i) => tally.set(t, (tally.get(t) ?? 0) + (20 - i)));
  const candidates = [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);

  const longPoints = points.slice(0, 25);
  let long = longPoints.map((p) => p.text).join(" ");
  const terms = candidates.filter((t) => long.toLowerCase().includes(t.toLowerCase())).slice(0, 12);
  // Make sure at least 3 key terms are present (add the sentences that hold them).
  for (const t of candidates) {
    if (terms.length >= 3) break;
    if (terms.includes(t)) continue;
    const holder = points.find((p) => termRegex(t).test(p.text) && !longPoints.includes(p));
    if (holder) {
      long += ` ${holder.text}`;
      terms.push(t);
    }
  }
  const ranked = scoreSentences(
    longPoints.map((p, order) => ({ ...p, order })),
    terms,
  )
    .sort((a, b) => b.score - a.score || a.s.order - b.s.order)
    .slice(0, 3)
    .sort((a, b) => a.s.order - b.s.order);
  let short = ranked.map(({ s }) => s.text).join(" ");
  if (short.length > 600) short = `${short.slice(0, 597).replace(/\s+\S*$/, "")}…`;
  return { short, long: long.slice(0, 8000), keyTerms: terms };
}

const DEFINITION = /^(?:(The|A|An)\s+)?([\p{L}][\p{L}\p{N}' -]{1,50}?)\s+(is|are|means|refers to|is defined as)\s+(.{12,})$/iu;

/**
 * "X is/are Y" sentences that really define X. Rejects passive or hedged
 * verbs ("DNA is copied into…", "X is not…") and keeps a natural article:
 * "The cell membrane is…" → { space: "the cell membrane", verb: "is" }.
 */
function definitionOf(sentence: string): { space: string; verb: "is" | "are" } | null {
  const m = DEFINITION.exec(sentence);
  if (!m) return null;
  const [, article, rawSpace, verbWord, rest] = m;
  const next = rest.split(/\s+/)[0].toLowerCase();
  if (/(ed|en)$/.test(next) || ["not", "also", "being", "often", "usually", "made", "found", "used", "very"].includes(next)) {
    return null;
  }
  const space = rawSpace.trim();
  if (words(space).length === 0 || space.split(" ").length > 6) return null;
  // "Mitochondria are…" → "mitochondria"; keep acronyms ("DNA") as they are.
  const head = /^[A-Z][a-z]/.test(space) ? space[0].toLowerCase() + space.slice(1) : space;
  return { space: article ? `the ${head}` : head, verb: verbWord.toLowerCase() === "are" ? "are" : "is" };
}

/** Flashcards: definition cards first, then cloze cards on key terms. */
export function mockFlashcards(sections: Section[], max: number, docTerms: string[] = []): FlashcardOutput[] {
  const sentences = splitSentences(sections);
  const terms = docTerms.length ? docTerms : keyTerms(sentences, 15);
  const cards: FlashcardOutput[] = [];
  const usedSentences = new Set<number>();
  const usedFronts = new Set<string>();

  for (const s of sentences) {
    if (cards.length >= max) break;
    const def = definitionOf(s.text);
    if (!def) continue;
    const front = `What ${def.verb} ${def.space}?`;
    if (usedFronts.has(front.toLowerCase())) continue;
    usedFronts.add(front.toLowerCase());
    usedSentences.add(s.order);
    cards.push({ front, back: s.text, page: s.page });
  }

  const scored = scoreSentences(sentences, terms).sort((a, b) => b.score - a.score || a.s.order - b.s.order);
  for (const { s, score } of scored) {
    if (cards.length >= max || score === 0) break;
    if (usedSentences.has(s.order)) continue;
    const term = terms.find((t) => termRegex(t).test(s.text));
    if (!term) continue;
    const front = s.text.replace(termRegex(term), "______");
    if (usedFronts.has(front.toLowerCase())) continue;
    usedFronts.add(front.toLowerCase());
    usedSentences.add(s.order);
    cards.push({ front: `Fill in the blank: ${front}`, back: `${term} — ${s.text}`, page: s.page });
  }
  // Reading order, so cards follow the file.
  return cards.sort((a, b) => a.page - b.page);
}

/** Quiz: ~70% multiple choice (blanked key term + 3 distractor terms), rest short answer. */
export function mockQuestions(
  sections: Section[],
  max: number,
  docTerms: string[] = [],
  seed = "quiz",
): QuestionOutput[] {
  const sentences = splitSentences(sections);
  const terms = docTerms.length >= 4 ? docTerms : keyTerms(sentences, 15);
  const rand = seeded(seed);
  const out: QuestionOutput[] = [];
  const used = new Set<number>();
  const mcTarget = Math.round(max * 0.7);

  const scored = scoreSentences(sentences, terms).sort((a, b) => b.score - a.score || a.s.order - b.s.order);
  for (const { s, score } of scored) {
    if (out.length >= mcTarget || score === 0) break;
    const term = terms.find((t) => termRegex(t).test(s.text));
    if (!term) continue;
    const pool = terms.filter((t) => t.toLowerCase() !== term.toLowerCase() && !termRegex(t).test(s.text));
    if (pool.length < 3) continue;
    const options = shuffle([term, ...shuffle(pool, rand).slice(0, 3)], rand);
    used.add(s.order);
    out.push({
      type: "MULTIPLE_CHOICE",
      question: `Which term completes the sentence? ${s.text.replace(termRegex(term), "______")}`,
      options,
      answer: term,
      explanation: `${s.text} (page ${s.page})`,
      page: s.page,
    });
  }

  for (const s of sentences) {
    if (out.length >= max) break;
    if (used.has(s.order)) continue;
    const def = definitionOf(s.text);
    if (!def) continue;
    used.add(s.order);
    out.push({
      type: "SHORT_ANSWER",
      question: `In your own words, what ${def.verb} ${def.space}?`,
      options: [],
      answer: s.text,
      explanation: `${s.text} (page ${s.page})`,
      page: s.page,
    });
  }
  return out.sort((a, b) => a.page - b.page).slice(0, max);
}
