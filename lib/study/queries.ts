import "server-only";

import { showStoredMessage } from "@/lib/ai/limit-reset";
import { endOfTodayInZone } from "@/lib/dates";
import { db } from "@/lib/db";
import { checkLimit } from "@/lib/limits";
import type { FileType } from "@/lib/generated/prisma/enums";

/** Where a card / question came from, for the source link. */
export type SourceRef = { documentId: string; title: string; fileType: FileType; page: number };

/** Counts for the tab labels. */
export async function getStudyCounts(userId: string, spaceId: string, timeZone: string) {
  const [due, questions] = await Promise.all([
    db.flashcard.count({ where: { userId, spaceId, nextReviewAt: { lt: endOfTodayInZone(timeZone) } } }),
    db.question.count({ where: { userId, spaceId } }),
  ]);
  return { due, questions };
}

export type SummaryEntry = {
  documentId: string;
  title: string;
  fileType: FileType;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  summary: { short: string; long: string; keyTerms: string[] } | null;
  /** Why the last run made nothing (e.g. not enough text), or null. */
  message: string | null;
};

/** Ready documents of a space with their summary state, newest first. */
export async function listSummaries(userId: string, spaceId: string, timeZone?: string): Promise<SummaryEntry[]> {
  const now = new Date();
  const docs = await db.document.findMany({
    where: { userId, spaceId, status: "READY" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      fileType: true,
      summary: { select: { short: true, long: true, keyTerms: true } },
      steps: { where: { step: "SUMMARY" }, select: { status: true, error: true, updatedAt: true } },
    },
  });
  return docs.map((d) => ({
    documentId: d.id,
    title: d.title,
    fileType: d.fileType,
    status: d.steps[0]?.status ?? "PENDING",
    summary: d.summary,
    // The stored daily-limit marker → the sentence with the reset time in the user's zone.
    message: showStoredMessage(d.steps[0]?.error ?? null, timeZone, d.steps[0]?.updatedAt, now),
  }));
}

export type ReviewCard = { id: string; front: string; back: string; source: SourceRef } & {
  ease: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
};

/** Due cards of a space (before the end of the user's today), oldest first. */
export async function getDueCards(userId: string, spaceId: string, timeZone: string, take = 50) {
  const endOfToday = endOfTodayInZone(timeZone);
  const [cards, total, next] = await Promise.all([
    db.flashcard.findMany({
      where: { userId, spaceId, nextReviewAt: { lt: endOfToday } },
      orderBy: [{ nextReviewAt: "asc" }, { id: "asc" }],
      take,
      select: {
        id: true,
        front: true,
        back: true,
        sourcePage: true,
        ease: true,
        intervalDays: true,
        repetitions: true,
        lapses: true,
        document: { select: { id: true, title: true, fileType: true } },
      },
    }),
    db.flashcard.count({ where: { userId, spaceId } }),
    db.flashcard.findFirst({
      where: { userId, spaceId, nextReviewAt: { gte: endOfToday } },
      orderBy: { nextReviewAt: "asc" },
      select: { nextReviewAt: true },
    }),
  ]);
  return {
    cards: cards.map(
      (c): ReviewCard => ({
        id: c.id,
        front: c.front,
        back: c.back,
        ease: c.ease,
        intervalDays: c.intervalDays,
        repetitions: c.repetitions,
        lapses: c.lapses,
        source: { documentId: c.document.id, title: c.document.title, fileType: c.document.fileType, page: c.sourcePage },
      }),
    ),
    total,
    nextDueAt: next?.nextReviewAt.toISOString() ?? null,
  };
}

/** Question as sent to the browser before answering: NO answer, NO explanation. */
export type QuizQuestion = {
  id: string;
  type: "MULTIPLE_CHOICE" | "SHORT_ANSWER";
  question: string;
  options: string[];
  source: SourceRef;
};

export async function getQuizQuestions(userId: string, spaceId: string, ids: string[]): Promise<QuizQuestion[]> {
  const rows = await db.question.findMany({
    where: { userId, spaceId, id: { in: ids } },
    select: {
      id: true,
      type: true,
      question: true,
      options: true,
      sourcePage: true,
      document: { select: { id: true, title: true, fileType: true } },
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map((r) => ({
      id: r.id,
      type: r.type,
      question: r.question,
      options: r.options,
      source: { documentId: r.document.id, title: r.document.title, fileType: r.document.fileType, page: r.sourcePage },
    }));
}

/** Start-screen info: how many questions, and the weekly Free limit. */
export async function getQuizInfo(userId: string, spaceId: string) {
  const [questions, limit] = await Promise.all([
    db.question.count({ where: { userId, spaceId } }),
    checkLimit(userId, "quiz"),
  ]);
  return { questions, limit: limit.limit, used: limit.used, pro: limit.pro, allowed: limit.allowed };
}
