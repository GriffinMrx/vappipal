import "server-only";

import { dayInZone, nextDay, startOfDayInZone } from "@/lib/dates";
import { db } from "@/lib/db";

/** One point of a Home chart: a calendar day ("YYYY-MM-DD", the user's day) and its value. */
export type DayPoint = { day: string; value: number };

/** Consecutive days starting at `from`. */
function daysFrom(from: string, count: number): string[] {
  const out = [from];
  while (out.length < count) out.push(nextDay(out[out.length - 1]));
  return out;
}

/** `count` days ending today. */
function lastDays(today: string, count: number): string[] {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (count - 1));
  return daysFrom(d.toISOString().slice(0, 10), count);
}

/** One formatter for many rows (creating one per row is slow). */
function dayOf(timeZone: string) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  return (at: Date) => f.format(at);
}

/**
 * The three Home charts (prompt 36), all for this user only, bucketed by the
 * user's own calendar day:
 * - cards due on each of the next 14 days (today includes overdue cards),
 * - quiz answers per day over the last 30 days (+ how many were right),
 * - documents the user had at the end of each of the last 30 days.
 */
export async function getHomeCharts(userId: string, timeZone: string) {
  const today = dayInZone(timeZone);
  const ahead = daysFrom(today, 14);
  const back = lastDays(today, 30);
  const dueEnd = startOfDayInZone(nextDay(ahead[ahead.length - 1]), timeZone);
  const since = startOfDayInZone(back[0], timeZone);
  const toDay = dayOf(timeZone);

  const [cards, attempts, docs] = await Promise.all([
    db.flashcard.findMany({ where: { userId, nextReviewAt: { lt: dueEnd } }, select: { nextReviewAt: true } }),
    db.attempt.findMany({ where: { userId, createdAt: { gte: since } }, select: { createdAt: true, correct: true } }),
    db.document.findMany({ where: { userId }, select: { createdAt: true } }),
  ]);

  const due = new Map(ahead.map((d) => [d, 0]));
  for (const c of cards) {
    const d = toDay(c.nextReviewAt);
    const key = d < today ? today : d;
    if (due.has(key)) due.set(key, due.get(key)! + 1);
  }

  const answered = new Map(back.map((d) => [d, 0]));
  let correct = 0;
  for (const a of attempts) {
    const d = toDay(a.createdAt);
    if (!answered.has(d)) continue;
    answered.set(d, answered.get(d)! + 1);
    if (a.correct) correct++;
  }
  const totalAnswers = [...answered.values()].reduce((s, n) => s + n, 0);

  const docDays = docs.map((x) => toDay(x.createdAt)).sort();
  let i = 0;
  const docSeries = back.map((day) => {
    while (i < docDays.length && docDays[i] <= day) i++;
    return { day, value: i };
  });

  return {
    cardsDue: ahead.map((day) => ({ day, value: due.get(day)! })),
    quiz: {
      series: back.map((day) => ({ day, value: answered.get(day)! })),
      total: totalAnswers,
      correctPct: totalAnswers ? Math.round((correct / totalAnswers) * 100) : null,
    },
    documents: docSeries,
  };
}
