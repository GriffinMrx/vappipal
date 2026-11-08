import "server-only";

import { dateColumnToDay, dayInZone, daysBetween } from "@/lib/dates";
import { db } from "@/lib/db";
import { ensurePlans, parseStoredDay } from "./service";
import type { SpacePlanView, TodayTask } from "./types";

/**
 * Plans for the given spaces (all of the user's when omitted), from today
 * to the goal date, plus the done/total count over the whole plan.
 */
export async function getPlans(userId: string, timeZone: string, spaceId?: string): Promise<SpacePlanView[]> {
  const spaces = await db.space.findMany({
    where: { userId, ...(spaceId ? { id: spaceId } : {}) },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, color: true, goalDate: true, goalLabel: true },
  });
  const views = spaces.map((s) => ({ ...s, goalDay: s.goalDate ? dateColumnToDay(s.goalDate) : null }));
  await ensurePlans(userId, timeZone, views.map((s) => ({ id: s.id, goalDate: s.goalDay })));

  const today = dayInZone(timeZone);
  const rows = await db.planDay.findMany({
    where: { userId, spaceId: { in: spaces.map((s) => s.id) } },
    orderBy: { date: "asc" },
    select: { spaceId: true, date: true, tasks: true },
  });

  return views.map((s) => {
    const mine = rows.filter((r) => r.spaceId === s.id).map((r) => ({ day: dateColumnToDay(r.date), ...parseStoredDay(r.tasks) }));
    const all = mine.flatMap((d) => d.tasks);
    const upcoming = s.goalDay && s.goalDay >= today;
    return {
      spaceId: s.id,
      spaceName: s.name,
      color: s.color,
      goalDate: s.goalDay,
      goalLabel: s.goalLabel,
      daysLeft: s.goalDay ? daysBetween(today, s.goalDay) : null,
      days: upcoming ? mine.filter((d) => d.day >= today) : [],
      doneTasks: all.filter((t) => t.done).length,
      totalTasks: all.length,
    };
  });
}


/** Today's tasks across every space (home + planner). */
export function todayTasks(plans: SpacePlanView[], today: string): TodayTask[] {
  return plans.flatMap((p) =>
    (p.days.find((d) => d.day === today)?.tasks ?? []).map((t) => ({
      ...t,
      spaceId: p.spaceId,
      spaceName: p.spaceName,
      color: p.color,
      day: today,
    })),
  );
}
