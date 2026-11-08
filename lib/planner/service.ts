import "server-only";

import { dateColumnToDay, dayInZone, dayToDateColumn } from "@/lib/dates";
import { db } from "@/lib/db";
import { buildPlan } from "./build";
import type { PlanTask } from "./types";

/** What a PlanDay.tasks JSON holds. */
export type StoredDay = { review: boolean; tasks: PlanTask[] };

export function parseStoredDay(value: unknown): StoredDay {
  const v = value as Partial<StoredDay> | PlanTask[] | null;
  if (Array.isArray(v)) return { review: false, tasks: v };
  return { review: Boolean(v?.review), tasks: Array.isArray(v?.tasks) ? v.tasks : [] };
}

/**
 * Rebuild a space's plan from today on (AGENTS.md §10). Past days are
 * history and never change; ticked tasks stay ticked (ids are stable).
 * Plain code, no AI: cheap to call on every trigger.
 */
export async function rebuildPlan(userId: string, spaceId: string) {
  const [user, space] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { timeZone: true } }),
    db.space.findFirst({ where: { id: spaceId, userId }, select: { id: true, goalDate: true } }),
  ]);
  if (!user || !space) return;
  const today = dayInZone(user.timeZone);
  const todayCol = dayToDateColumn(today);

  const existing = await db.planDay.findMany({ where: { userId, spaceId }, select: { date: true, tasks: true } });
  const doneIds = new Set(existing.flatMap((d) => parseStoredDay(d.tasks).tasks.filter((t) => t.done).map((t) => t.id)));
  // What was already ticked today stays on today, even if the new plan wouldn't schedule it.
  const doneToday = existing
    .filter((d) => dateColumnToDay(d.date) === today)
    .flatMap((d) => parseStoredDay(d.tasks).tasks.filter((t) => t.done));

  const goalDay = space.goalDate ? dateColumnToDay(space.goalDate) : null;
  let rows: { day: string; stored: StoredDay; done: boolean }[] = [];
  if (goalDay && goalDay >= today) {
    const [documents, cards, questions] = await Promise.all([
      db.document.findMany({
        where: { userId, spaceId, status: "READY" },
        orderBy: { createdAt: "asc" },
        select: { id: true, title: true },
      }),
      db.flashcard.findMany({
        where: { userId, spaceId },
        select: { documentId: true, nextReviewAt: true, repetitions: true },
      }),
      db.question.count({ where: { userId, spaceId } }),
    ]);
    const plan = buildPlan({
      today,
      goalDay,
      documents,
      cards: cards.map((c) => ({
        documentId: c.documentId,
        dueDay: dayInZone(user.timeZone, c.nextReviewAt),
        isNew: c.repetitions === 0,
      })),
      hasQuestions: questions > 0,
      doneIds,
    });
    rows = plan.map((d) => {
      const kept = d.day === today ? doneToday.filter((t) => !d.tasks.some((n) => n.id === t.id)) : [];
      const tasks = [...kept, ...d.tasks];
      return { day: d.day, stored: { review: d.review, tasks }, done: tasks.length > 0 && tasks.every((t) => t.done) };
    });
  }

  await db.$transaction([
    db.planDay.deleteMany({ where: { userId, spaceId, date: { gte: todayCol } } }),
    db.planDay.createMany({
      data: rows.map((r) => ({
        userId,
        spaceId,
        date: dayToDateColumn(r.day),
        tasks: r.stored,
        done: r.done,
      })),
      skipDuplicates: true,
    }),
  ]);
}

/** Rebuild once a day (first view of a new day) so flashcard counts stay current. */
export async function ensurePlans(userId: string, timeZone: string, spaces: { id: string; goalDate: string | null }[]) {
  const today = dayInZone(timeZone);
  const upcoming = spaces.filter((s) => s.goalDate && s.goalDate >= today);
  if (upcoming.length === 0) return;
  const haveToday = await db.planDay.findMany({
    where: { userId, spaceId: { in: upcoming.map((s) => s.id) }, date: dayToDateColumn(today) },
    select: { spaceId: true },
  });
  const have = new Set(haveToday.map((r) => r.spaceId));
  await Promise.all(upcoming.filter((s) => !have.has(s.id)).map((s) => rebuildPlan(userId, s.id)));
}

/** Fire-and-forget-safe wrapper for triggers: a plan problem never breaks the main action. */
export async function rebuildPlanSafely(userId: string, spaceId: string) {
  try {
    await rebuildPlan(userId, spaceId);
  } catch (err) {
    console.error("Plan rebuild failed", (err as Error)?.name);
  }
}
