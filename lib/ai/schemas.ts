import { z } from "zod";

/**
 * Zod schemas for AI study material (AGENTS.md §7: validate every AI output).
 * Built per call with the pages that were actually sent, so every source page
 * must be a real page of the user's own document (grounded).
 */

const pageOf = (pages: ReadonlySet<number>) =>
  z
    .number()
    .int()
    .refine((p) => pages.has(p), "page must be one of the pages provided");

export const summarySchema = z
  .object({
    short: z.string().trim().min(1).max(600),
    long: z.string().trim().min(1).max(8000),
    keyTerms: z.array(z.string().trim().min(1).max(60)).min(3).max(15),
  })
  .refine((s) => new Set(s.keyTerms.map((t) => t.toLowerCase())).size === s.keyTerms.length, {
    message: "key terms must be unique",
    path: ["keyTerms"],
  })
  .refine((s) => s.keyTerms.every((t) => s.long.toLowerCase().includes(t.toLowerCase())), {
    message: "every key term must appear in the long summary",
    path: ["keyTerms"],
  });

export type SummaryOutput = z.infer<typeof summarySchema>;

/** Partial summary of one section (map step); merged later. */
export const sectionSummarySchema = (pages: ReadonlySet<number>) =>
  z.object({
    points: z
      .array(z.object({ text: z.string().trim().min(1).max(600), page: pageOf(pages) }))
      .min(1)
      .max(30),
    keyTerms: z.array(z.string().trim().min(1).max(60)).max(20),
  });

export type SectionSummaryOutput = z.infer<ReturnType<typeof sectionSummarySchema>>;

export const flashcardsSchema = (pages: ReadonlySet<number>, max: number) =>
  z
    .array(
      z.object({
        front: z.string().trim().min(1).max(300),
        back: z.string().trim().min(1).max(600),
        page: pageOf(pages),
      }),
    )
    .max(max);

export type FlashcardOutput = z.infer<ReturnType<typeof flashcardsSchema>>[number];

export const questionsSchema = (pages: ReadonlySet<number>, max: number) =>
  z
    .array(
      z
        .discriminatedUnion("type", [
          z.object({
            type: z.literal("MULTIPLE_CHOICE"),
            question: z.string().trim().min(1).max(500),
            options: z.array(z.string().trim().min(1).max(200)).length(4),
            answer: z.string().trim().min(1).max(200),
            explanation: z.string().trim().min(1).max(800),
            page: pageOf(pages),
          }),
          z.object({
            type: z.literal("SHORT_ANSWER"),
            question: z.string().trim().min(1).max(500),
            options: z.array(z.string()).length(0),
            answer: z.string().trim().min(1).max(600),
            explanation: z.string().trim().min(1).max(800),
            page: pageOf(pages),
          }),
        ])
        .refine((q) => q.type !== "MULTIPLE_CHOICE" || new Set(q.options).size === 4, {
          message: "options must be unique",
        })
        .refine((q) => q.type !== "MULTIPLE_CHOICE" || q.options.includes(q.answer), {
          message: "answer must be one of the options",
        }),
    )
    .max(max);

export type QuestionOutput = z.infer<ReturnType<typeof questionsSchema>>[number];
