import "server-only";

import { InvalidAIOutput, writeFlashcards, writeQuestions, writeSummary, type StudyPart } from "@/lib/ai/study";
import { AI_DAILY_LIMIT_MESSAGE, AiDailyLimitError } from "@/lib/ai/gemini";
import { letterCount, splitSentences, type Section } from "@/lib/ai/text";
import { db } from "@/lib/db";
import { NOTE_CARD_LIMIT, NOTE_NOT_ENOUGH_TEXT } from "@/lib/documents/types";
import type { DocumentStepKind } from "@/lib/generated/prisma/enums";
import { checkLimit } from "@/lib/limits";
import { STUDY_AMOUNTS } from "@/lib/plans";

export const PART_STEP: Record<StudyPart, DocumentStepKind> = {
  summary: "SUMMARY",
  flashcards: "FLASHCARDS",
  quiz: "QUIZ",
};

const FAILED_MESSAGE: Record<StudyPart, string> = {
  summary: "The summary couldn't be created this time. Try again.",
  flashcards: "The flashcards couldn't be created this time. Try again.",
  quiz: "The quiz couldn't be created this time. Try again.",
};


/** Join overlapping chunks back into page text (chunks overlap by ~150 chars). */
export function joinChunks(chunks: { page: number; index: number; text: string }[]): Section[] {
  const byPage = new Map<number, string>();
  for (const c of [...chunks].sort((a, b) => a.index - b.index)) {
    const prev = byPage.get(c.page);
    if (prev === undefined) {
      byPage.set(c.page, c.text);
      continue;
    }
    // Drop the longest prefix of this chunk that the previous text already ends with.
    let cut = 0;
    for (let n = Math.min(400, c.text.length, prev.length); n >= 20; n--) {
      if (prev.endsWith(c.text.slice(0, n))) {
        cut = n;
        break;
      }
    }
    byPage.set(c.page, `${prev} ${c.text.slice(cut)}`.replace(/\s+/g, " "));
  }
  return [...byPage.entries()].map(([page, text]) => ({ page, text })).sort((a, b) => a.page - b.page);
}

async function setStep(
  documentId: string,
  part: StudyPart,
  data: { status: "RUNNING" | "DONE" | "FAILED"; error?: string | null },
) {
  await db.documentStep.updateMany({
    where: { documentId, step: PART_STEP[part] },
    data: {
      status: data.status,
      error: data.error ?? null,
      ...(data.status === "RUNNING" ? { attempts: { increment: 1 } } : {}),
    },
  });
}

/**
 * Generate and save one part of a document's study material. Replaces that
 * document's existing summary / cards / questions in one transaction, so
 * retries and "regenerate" never duplicate anything.
 *
 * Invalid AI output (after the built-in retry) marks only this step FAILED.
 * Other errors are rethrown so Inngest retries the step; on the last attempt
 * (`finalAttempt`) they also just fail this step instead of the document.
 */
export async function runPart(
  { documentId, userId }: { documentId: string; userId: string },
  part: StudyPart,
  { finalAttempt = false, seed = "" }: { finalAttempt?: boolean; seed?: string } = {},
): Promise<"done" | "failed" | "gone"> {
  // Scope by BOTH ids, from the DB, never trusting the event alone.
  const doc = await db.document.findFirst({
    where: { id: documentId, userId },
    select: { id: true, userId: true, spaceId: true },
  });
  if (!doc) return "gone";

  await setStep(doc.id, part, { status: "RUNNING" });
  try {
    const chunks = await db.chunk.findMany({
      where: { documentId: doc.id, userId: doc.userId },
      select: { page: true, index: true, text: true },
    });
    // OCR placeholders (mock) are not study material.
    const pages = joinChunks(chunks).filter((p) => !p.text.startsWith("[OCR preview]"));
    // At least 3 sentences, or (text with little punctuation) at least 200 letters in any script.
    if (splitSentences(pages).length < 3 && letterCount(pages) < 200) {
      await setStep(doc.id, part, { status: "DONE", error: NOTE_NOT_ENOUGH_TEXT });
      return "done";
    }

    if (part === "summary") {
      const s = await writeSummary(pages);
      await db.$transaction([
        db.summary.deleteMany({ where: { documentId: doc.id } }),
        db.summary.create({ data: { documentId: doc.id, short: s.short, long: s.long, keyTerms: s.keyTerms } }),
      ]);
      await setStep(doc.id, part, { status: "DONE" });
    } else if (part === "flashcards") {
      const keyTerms = (await db.summary.findUnique({ where: { documentId: doc.id }, select: { keyTerms: true } }))
        ?.keyTerms ?? [];
      const max = Math.min(STUDY_AMOUNTS.cardsPerDocument, Math.max(5, pages.length));
      const cards = await writeFlashcards(pages, max, keyTerms);

      // Free cap (server-side): this document's old cards are being replaced, so they don't count.
      const existing = await db.flashcard.count({ where: { documentId: doc.id } });
      const limit = await checkLimit(doc.userId, "flashcards", { adding: 0 });
      const room = limit.limit === null ? cards.length : Math.max(0, limit.limit - (limit.used - existing));
      const keep = cards.slice(0, room);

      await db.$transaction([
        db.flashcard.deleteMany({ where: { documentId: doc.id } }),
        db.flashcard.createMany({
          data: keep.map((c) => ({
            userId: doc.userId,
            spaceId: doc.spaceId,
            documentId: doc.id,
            front: c.front,
            back: c.back,
            sourcePage: c.page,
          })),
        }),
      ]);
      await setStep(doc.id, part, {
        status: "DONE",
        error: keep.length < cards.length ? NOTE_CARD_LIMIT : null,
      });
    } else {
      const keyTerms = (await db.summary.findUnique({ where: { documentId: doc.id }, select: { keyTerms: true } }))
        ?.keyTerms ?? [];
      const questions = await writeQuestions(pages, STUDY_AMOUNTS.questionsPerDocument, keyTerms, `${doc.id}:${seed}`);
      await db.$transaction([
        db.question.deleteMany({ where: { documentId: doc.id } }),
        db.question.createMany({
          data: questions.map((q) => ({
            userId: doc.userId,
            spaceId: doc.spaceId,
            documentId: doc.id,
            type: q.type,
            question: q.question,
            options: q.options,
            answer: q.answer,
            explanation: q.explanation,
            sourcePage: q.page,
          })),
        }),
      ]);
      await setStep(doc.id, part, { status: "DONE" });
    }
    return "done";
  } catch (err) {
    if (err instanceof AiDailyLimitError) {
      // Retrying soon can't help: say so, and the user can press Try again later.
      await setStep(doc.id, part, { status: "FAILED", error: AI_DAILY_LIMIT_MESSAGE });
      return "failed";
    }
    if (err instanceof InvalidAIOutput || finalAttempt) {
      console.error("Study material step failed", part, err instanceof Error ? err.name : "error");
      await setStep(doc.id, part, { status: "FAILED", error: FAILED_MESSAGE[part] });
      return "failed";
    }
    throw err; // transient: let Inngest retry this step
  }
}
