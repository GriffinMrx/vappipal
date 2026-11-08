import "server-only";

import { firstName } from "@/lib/auth/current-user";
import { hasProAccess } from "@/lib/billing/access";
import { dateColumnToDay, dayInZone, daysBetween, endOfTodayInZone } from "@/lib/dates";
import { db } from "@/lib/db";
import { getPlans, todayTasks } from "@/lib/planner/queries";
import type { ReminderContent, ReminderSpace } from "./rules";

/** Goal dates further away than this aren't mentioned in the email. */
const GOAL_HORIZON_DAYS = 60;

/**
 * What today's email says, for one user: due flashcards per Space and,
 * for Pro, today's plan tasks. Space names and counts only, never file
 * text or file names. null = nothing to do → no email.
 */
export async function buildReminderContent(userId: string, now = new Date()): Promise<ReminderContent | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, timeZone: true },
  });
  if (!user) return null;
  const today = dayInZone(user.timeZone, now);
  const [pro, spaces, due] = await Promise.all([
    hasProAccess(user.id, now),
    db.space.findMany({ where: { userId }, select: { id: true, name: true, goalDate: true, goalLabel: true }, orderBy: { createdAt: "asc" } }),
    db.flashcard.groupBy({
      by: ["spaceId"],
      where: { userId, nextReviewAt: { lt: endOfTodayInZone(user.timeZone, now) } },
      _count: { _all: true },
    }),
  ]);
  const dueBySpace = new Map(due.map((d) => [d.spaceId, d._count._all]));
  const tasks = pro ? todayTasks(await getPlans(user.id, user.timeZone), today) : [];

  const list: ReminderSpace[] = spaces
    .map((s) => {
      const mine = tasks.filter((t) => t.spaceId === s.id && !t.done);
      const goal = s.goalDate ? daysBetween(today, dateColumnToDay(s.goalDate)) : null;
      return {
        name: s.name,
        read: mine.filter((t) => t.kind === "read").length,
        cards: dueBySpace.get(s.id) ?? 0,
        quiz: mine.some((t) => t.kind === "quiz"),
        daysLeft: goal !== null && goal >= 0 && goal <= GOAL_HORIZON_DAYS ? goal : null,
        goalLabel: s.goalLabel,
      };
    })
    .filter((s) => s.read || s.cards || s.quiz);

  if (list.length === 0) return null;
  return {
    firstName: firstName(user),
    pro,
    spaces: list,
    totals: {
      read: list.reduce((n, s) => n + s.read, 0),
      cards: list.reduce((n, s) => n + s.cards, 0),
      quizzes: list.filter((s) => s.quiz).length,
    },
  };
}
