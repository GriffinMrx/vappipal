import "server-only";

import { z } from "zod";
import { generateJson, MODELS } from "./gemini";
import { gradeJson } from "./json-schemas";
import { GRADE_SYSTEM, gradeInput } from "./prompts";
import { aiProvider } from "./study";
import { words } from "./text";

/**
 * Short-answer grading against the STORED answer (AGENTS.md §7), with the
 * "smart" model (AI_MODEL_SMART). The question, reference and user answer
 * are passed as data (./prompts.ts); output { correct, feedback } is
 * validated with Zod and retried once. AI_PROVIDER=mock keeps the word-overlap mock.
 */

export const gradeSchema = z.object({
  correct: z.boolean(),
  feedback: z.string().trim().min(1).max(400),
});
export type GradeOutput = z.infer<typeof gradeSchema>;

export class InvalidGradeOutput extends Error {
  constructor() {
    super("Invalid grading output");
    this.name = "InvalidGradeOutput";
  }
}

/** Mock: meaningful-word overlap with the stored answer. */
export function mockGrade(question: string, expected: string, given: string): GradeOutput {
  const questionWords = new Set(words(question));
  // Words that carry the answer: in the expected answer but not just repeated from the question.
  const key = [...new Set(words(expected))].filter((w) => !questionWords.has(w));
  const target = key.length ? key : [...new Set(words(expected))];
  const givenWords = new Set(words(given).map(stem));
  const hits = target.filter((w) => givenWords.has(stem(w)));
  const ratio = target.length ? hits.length / target.length : 0;

  if (!words(given).length) return { correct: false, feedback: "No answer was given." };
  if (ratio >= 0.5) {
    return { correct: true, feedback: "Correct — your answer covers the key points from your files." };
  }
  if (ratio >= 0.25) {
    const missing = target.filter((w) => !givenWords.has(stem(w))).slice(0, 3);
    return {
      correct: false,
      feedback: `Partly right. Your files also mention: ${missing.join(", ")}.`,
    };
  }
  return { correct: false, feedback: "Not quite. Compare your answer with the one from your files below." };
}

/** Very small stemmer so "produces" matches "produce". */
function stem(w: string) {
  return w.replace(/(ies|es|s|ing|ed)$/, "");
}

export async function gradeShortAnswer(question: string, expected: string, given: string): Promise<GradeOutput> {
  const gemini = aiProvider() === "gemini";
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = gemini
      ? await generateJson({
          model: MODELS.smart,
          system: GRADE_SYSTEM,
          input: gradeInput(question, expected, given),
          schema: gradeJson,
          maxOutputTokens: 1024,
          timeoutMs: 45_000, // the user is waiting on this one
        })
      : mockGrade(question, expected, given);
    const parsed = gradeSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
  }
  throw new InvalidGradeOutput();
}
