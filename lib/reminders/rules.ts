import { goalCountdown } from "@/lib/spaces/goal";
import { dayInZone, hourInZone } from "@/lib/dates";

/** Local hour the reminder goes out (env REMINDER_HOUR, default 8). */
export function reminderHour() {
  const h = Number(process.env.REMINDER_HOUR);
  return Number.isInteger(h) && h >= 0 && h <= 21 ? h : 8;
}

/** Latest local hour a late (missed) reminder is still sent. */
const LAST_HOUR = 21;

/**
 * Should this user get today's reminder now? Their local hour must be in
 * [reminderHour, 21] and they must not have had one today (their day).
 */
export function shouldRemindNow(
  u: { timeZone: string; lastReminderOn: string | null },
  now: Date,
  hour = reminderHour(),
): { due: boolean; day: string } {
  const day = dayInZone(u.timeZone, now);
  const local = hourInZone(u.timeZone, now);
  return { due: local >= hour && local <= LAST_HOUR && u.lastReminderOn !== day, day };
}

export type ReminderSpace = {
  name: string;
  read: number;
  cards: number;
  quiz: boolean;
  /** Whole days to the goal date, or null. */
  daysLeft: number | null;
  goalLabel: string | null;
};

export type ReminderContent = {
  firstName: string;
  pro: boolean;
  spaces: ReminderSpace[];
  totals: { read: number; cards: number; quizzes: number };
};

/** "20 flashcards and 1 quiz" (null when there's nothing to do → no email). */
export function summaryLine(t: ReminderContent["totals"]): string | null {
  const parts = [
    t.read ? `${t.read} summar${t.read === 1 ? "y" : "ies"} to read` : null,
    t.cards ? `${t.cards} flashcard${t.cards === 1 ? "" : "s"}` : null,
    t.quizzes ? `${t.quizzes} quiz${t.quizzes === 1 ? "" : "zes"}` : null,
  ].filter((p): p is string => p !== null);
  if (parts.length === 0) return null;
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

export function goalText(daysLeft: number | null, label: string | null) {
  if (daysLeft === null) return null;
  return goalCountdown(daysLeft, label);
}
