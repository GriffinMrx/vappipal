import "server-only";

import type { z } from "zod";
import { generateJson, MODELS } from "./gemini";
import { flashcardsJson, questionsJson, sectionSummaryJson, summaryJson } from "./json-schemas";
import { mockFlashcards, mockMergeSummaries, mockQuestions, mockSummarizeSection } from "./mock-study";
import {
  FLASHCARDS_SYSTEM,
  materialBlock,
  QUESTIONS_SYSTEM,
  SUMMARY_MERGE_SYSTEM,
  SUMMARY_SECTION_SYSTEM,
} from "./prompts";
import {
  flashcardsSchema,
  questionsSchema,
  sectionSummarySchema,
  summarySchema,
  type FlashcardOutput,
  type QuestionOutput,
  type SectionSummaryOutput,
  type SummaryOutput,
} from "./schemas";
import type { Section } from "./text";

/**
 * Study material from the user's OWN document only (AGENTS.md §7).
 *
 * Provider: AI_PROVIDER=gemini (default when GEMINI_API_KEY is set) | mock.
 * Models live in env (AI_MODEL_FAST for this file). Prompts: ./prompts.ts —
 * file text is wrapped as data and the model is told to ignore any
 * instructions inside it (§12). Every output is validated with the Zod
 * schemas in ./schemas.ts (real pages only, answer among options, …), retried
 * once if invalid, then the step is marked failed — nothing broken is saved.
 *
 * Long documents are processed in sections of SECTION_PAGES pages; no call
 * ever receives the whole document (§9).
 */

export const SECTION_PAGES = 20;

export type StudyPart = "summary" | "flashcards" | "quiz";

/** The AI output stayed invalid after one retry. */
export class InvalidAIOutput extends Error {
  constructor(public part: StudyPart) {
    super(`Invalid AI output for ${part}`);
    this.name = "InvalidAIOutput";
  }
}

/** Counts provider calls (tests check batching). */
export const aiCalls = { count: 0 };

export function aiProvider(): "gemini" | "mock" {
  const p = process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? "gemini" : "mock");
  if (p !== "gemini" && p !== "mock") throw new Error(`AI provider "${p}" is not supported`);
  return p;
}

/**
 * Test-only failure injection: AI_MOCK_FAIL=summary|flashcards|quiz|<part>-once.
 * Never active on the real production deployment (Vercel production or the
 * production Neon branch), even if the variable is set there by mistake.
 */
function shouldCorrupt(part: StudyPart, attempt: number) {
  const branch = process.env.NEON_BRANCH ?? "";
  if (process.env.VERCEL_ENV === "production" || branch === "production" || branch === "main") return false;
  const flags = (process.env.AI_MOCK_FAIL ?? "").split(",").map((f) => f.trim());
  return flags.includes(part) || (flags.includes(`${part}-once`) && attempt === 0);
}

/** Call → validate → retry once → throw. */
async function generateValidated<S extends z.ZodTypeAny>(
  part: StudyPart,
  schema: S,
  call: () => unknown,
): Promise<z.output<S>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    aiCalls.count++;
    const raw = shouldCorrupt(part, attempt) ? { broken: true } : await call();
    const parsed = schema.safeParse(raw);
    if (parsed.success) return parsed.data;
  }
  throw new InvalidAIOutput(part);
}

/** Group pages into sections of SECTION_PAGES consecutive pages. */
export function toSections(pages: Section[]): Section[][] {
  const sorted = [...pages].sort((a, b) => a.page - b.page);
  const out: Section[][] = [];
  for (let i = 0; i < sorted.length; i += SECTION_PAGES) out.push(sorted.slice(i, i + SECTION_PAGES));
  return out;
}

const pageSet = (sections: Section[]) => new Set(sections.map((s) => s.page));
const pageList = (sections: Section[]) => sections.map((s) => s.page);

// ── Gemini calls (return raw JSON shaped like the Zod schemas) ─────────────

async function geminiSectionSummary(section: Section[]) {
  return generateJson({
    model: MODELS.fast,
    system: SUMMARY_SECTION_SYSTEM,
    input: `${materialBlock(section)}\n\nWrite the key points of this material (about one per page, at most 30) and its key terms.`,
    schema: sectionSummaryJson(pageList(section)),
  });
}

async function geminiMerge(parts: SectionSummaryOutput[]) {
  const points = parts
    .flatMap((p) => p.points)
    .map((p) => `- (page ${p.page}) ${p.text}`)
    .join("\n");
  const terms = [...new Set(parts.flatMap((p) => p.keyTerms))].join(", ");
  return generateJson({
    model: MODELS.fast,
    system: SUMMARY_MERGE_SYSTEM,
    input: `<file_material>\nKey points:\n${points}\n\nCandidate key terms: ${terms}\n</file_material>\n\nWrite the short summary, the long summary and the key terms.`,
    schema: summaryJson,
  });
}

async function geminiFlashcards(section: Section[], max: number, keyTerms: string[]) {
  const res = (await generateJson({
    model: MODELS.fast,
    system: FLASHCARDS_SYSTEM,
    input: `${materialBlock(section)}\n\nWrite up to ${max} flashcards covering the most important facts${keyTerms.length ? ` (key terms of the material: ${keyTerms.join(", ")})` : ""}.`,
    schema: flashcardsJson(pageList(section), max),
  })) as { cards?: unknown } | null;
  return res?.cards;
}

/** ~70% multiple choice, but at least one short answer when there's room for 2+. */
const mcCount = (max: number) => (max <= 1 ? max : Math.min(max - 1, Math.max(1, Math.round(max * 0.7))));

async function geminiQuestions(section: Section[], max: number, keyTerms: string[]) {
  // Exact counts: "about 70%" alone led Gemini to write only multiple choice.
  const mc = mcCount(max);
  const res = (await generateJson({
    model: MODELS.fast,
    system: QUESTIONS_SYSTEM,
    input: `${materialBlock(section)}\n\nWrite ${mc} MULTIPLE_CHOICE and ${max - mc} SHORT_ANSWER questions${keyTerms.length ? ` (key terms of the material: ${keyTerms.join(", ")})` : ""}.`,
    schema: questionsJson(pageList(section), max),
  })) as { questions?: unknown } | null;
  return res?.questions;
}

// ── Public API (provider-independent) ──────────────────────────────────────

export async function writeSummary(pages: Section[]): Promise<SummaryOutput> {
  const gemini = aiProvider() === "gemini";
  const parts: SectionSummaryOutput[] = [];
  for (const section of toSections(pages)) {
    parts.push(
      await generateValidated("summary", sectionSummarySchema(pageSet(section)), () =>
        gemini ? geminiSectionSummary(section) : mockSummarizeSection(section),
      ),
    );
  }
  return generateValidated("summary", summarySchema, () => (gemini ? geminiMerge(parts) : mockMergeSummaries(parts)));
}

/** Split `max` across sections by page count (at least 1 each when possible). */
function shares(sections: Section[][], max: number) {
  const total = sections.reduce((n, s) => n + s.length, 0) || 1;
  return sections.map((s) => Math.max(1, Math.round((max * s.length) / total)));
}

export async function writeFlashcards(pages: Section[], max: number, keyTerms: string[]): Promise<FlashcardOutput[]> {
  const gemini = aiProvider() === "gemini";
  const sections = toSections(pages);
  const per = shares(sections, max);
  const out: FlashcardOutput[] = [];
  for (const [i, section] of sections.entries()) {
    const cards = await generateValidated("flashcards", flashcardsSchema(pageSet(section), per[i]), () =>
      gemini ? geminiFlashcards(section, per[i], keyTerms) : mockFlashcards(section, per[i], keyTerms),
    );
    out.push(...cards);
  }
  const seen = new Set<string>();
  return out.filter((c) => !seen.has(c.front.toLowerCase()) && seen.add(c.front.toLowerCase())).slice(0, max);
}

export async function writeQuestions(
  pages: Section[],
  max: number,
  keyTerms: string[],
  seed: string,
): Promise<QuestionOutput[]> {
  const gemini = aiProvider() === "gemini";
  const sections = toSections(pages);
  const per = shares(sections, max);
  const out: QuestionOutput[] = [];
  for (const [i, section] of sections.entries()) {
    const qs = await generateValidated("quiz", questionsSchema(pageSet(section), per[i]), () =>
      gemini ? geminiQuestions(section, per[i], keyTerms) : mockQuestions(section, per[i], keyTerms, `${seed}:${i}`),
    );
    out.push(...qs);
  }
  const seen = new Set<string>();
  return out.filter((q) => !seen.has(q.question.toLowerCase()) && seen.add(q.question.toLowerCase())).slice(0, max);
}
