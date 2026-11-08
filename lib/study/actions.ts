"use server";

import { InvalidGradeOutput, gradeShortAnswer } from "@/lib/ai/grading";
import { aiErrorMessage } from "@/lib/ai/limit-message";
import { getCurrentDbUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { checkLimit } from "@/lib/limits";
import { z } from "zod";
import { signQuizToken, verifyQuizToken } from "./quiz-token";
import { GRADES, schedule } from "./sm2";

const id = z.string().trim().min(1).max(64);
const QUIZ_SIZE = 10;

export type GradeCardResult = { ok: true; nextReviewAt: string } | { ok: false; error: string };

/**
 * Grade a flashcard (optimistic on the client). SM-2 runs here on the STORED
 * values; the client only sends the card id and the grade.
 */
export async function gradeFlashcard(input: { cardId: string; grade: string }): Promise<GradeCardResult> {
  const user = await getCurrentDbUser();
  const parsed = z.object({ cardId: id, grade: z.enum(GRADES) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "This card can't be graded." };

  const card = await db.flashcard.findFirst({
    where: { id: parsed.data.cardId, userId: user.id },
    select: { id: true, ease: true, intervalDays: true, repetitions: true, lapses: true },
  });
  if (!card) return { ok: false, error: "Card not found." };

  const now = new Date();
  const next = schedule(card, parsed.data.grade, now);
  await db.flashcard.update({
    where: { id: card.id },
    data: {
      ease: next.ease,
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
      lapses: next.lapses,
      nextReviewAt: next.nextReviewAt,
      lastReviewedAt: now,
    },
  });
  return { ok: true, nextReviewAt: next.nextReviewAt.toISOString() };
}

export type StartQuizResult =
  | { ok: true; questionIds: string[]; token: string }
  | { ok: false; error: string }
  | { ok: false; limitReached: { limit: number; used: number } };

/**
 * Start a quiz: enforce the weekly Free limit (server-side), record the
 * usage, and pick questions: never answered first, then answered wrong,
 * then the rest (shuffled within each group).
 */
export async function startQuiz(input: { spaceId: string }): Promise<StartQuizResult> {
  const user = await getCurrentDbUser();
  const parsed = z.object({ spaceId: id }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Space not found." };
  const space = await db.space.findFirst({ where: { id: parsed.data.spaceId, userId: user.id }, select: { id: true } });
  if (!space) return { ok: false, error: "Space not found." };

  const questions = await db.question.findMany({
    where: { userId: user.id, spaceId: space.id },
    select: { id: true, attempts: { where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 1, select: { correct: true } } },
  });
  if (questions.length === 0) return { ok: false, error: "This Space has no quiz questions yet." };

  const limit = await checkLimit(user.id, "quiz");
  if (!limit.allowed) return { ok: false, limitReached: { limit: limit.limit ?? 0, used: limit.used } };

  const shuffle = <T,>(a: T[]) => {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
  const fresh = questions.filter((q) => q.attempts.length === 0);
  const wrong = questions.filter((q) => q.attempts[0]?.correct === false);
  const right = questions.filter((q) => q.attempts[0]?.correct === true);
  const questionIds = [...shuffle(fresh), ...shuffle(wrong), ...shuffle(right)].slice(0, QUIZ_SIZE).map((q) => q.id);

  await db.usageEvent.create({ data: { userId: user.id, kind: "QUIZ" } });
  return { ok: true, questionIds, token: signQuizToken(user.id, questionIds) };
}

export type AnswerResult =
  | {
      ok: true;
      correct: boolean;
      correctAnswer: string;
      explanation: string;
      feedback: string | null;
    }
  | { ok: false; error: string };

/**
 * Answer one question of a started quiz. Multiple choice is graded by code,
 * short answer by the AI grader against the stored answer. Every answer is
 * saved as an Attempt. Not optimistic.
 */
export async function answerQuestion(input: {
  token: string;
  questionId: string;
  answer: string;
}): Promise<AnswerResult> {
  const user = await getCurrentDbUser();
  const parsed = z
    .object({ token: z.string().min(10).max(4000), questionId: id, answer: z.string().max(2000) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "This answer couldn't be checked." };

  const quiz = verifyQuizToken(parsed.data.token, user.id);
  if (!quiz || !quiz.questionIds.includes(parsed.data.questionId)) {
    return { ok: false, error: "This quiz has expired. Start a new one." };
  }
  const q = await db.question.findFirst({
    where: { id: parsed.data.questionId, userId: user.id },
    select: { id: true, type: true, question: true, options: true, answer: true, explanation: true },
  });
  if (!q) return { ok: false, error: "Question not found." };

  const given = parsed.data.answer.trim();
  if (!given) return { ok: false, error: "Write or pick an answer first." };

  let correct: boolean;
  let feedback: string | null = null;
  if (q.type === "MULTIPLE_CHOICE") {
    if (!q.options.includes(given)) return { ok: false, error: "Pick one of the options." };
    correct = given === q.answer;
  } else {
    try {
      const g = await gradeShortAnswer(q.question, q.answer, given);
      correct = g.correct;
      feedback = g.feedback;
    } catch (err) {
      if (err instanceof InvalidGradeOutput) return { ok: false, error: "Couldn't check this answer. Try again." };
      const message = await aiErrorMessage(err, user.id, "");
      if (message) return { ok: false, error: message };
      throw err;
    }
  }

  await db.attempt.create({ data: { userId: user.id, questionId: q.id, answer: given, correct, feedback } });
  return { ok: true, correct, correctAnswer: q.answer, explanation: q.explanation, feedback };
}
