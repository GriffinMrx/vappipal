import "server-only";

import { dateColumnToDay } from "@/lib/dates";
import { db } from "@/lib/db";
import { deliverReminder } from "@/lib/reminders/deliver";
import { shouldRemindNow } from "@/lib/reminders/rules";
import { emailMode } from "@/lib/email/send";
import { EVENTS, inngest } from "./client";

const PAGE = 500;

/**
 * Hourly: find users whose local morning it is and who haven't had
 * today's reminder, then fan out one send per user (AGENTS.md §10:
 * one email a day, in the user's time zone).
 */
export const scanReminders = inngest.createFunction(
  { id: "reminders-scan", triggers: [{ cron: "TZ=UTC 0 * * * *" }], retries: 2, concurrency: [{ limit: 1 }] },
  async ({ step }) => {
    if (emailMode() === "disabled") {
      console.warn("Reminders disabled: RESEND_API_KEY is not set");
      return { queued: 0 };
    }
    let cursor: string | undefined;
    let queued = 0;
    for (let page = 0; page < 1000; page++) {
      const batch = await step.run(`find-${page}`, async () => {
        const now = new Date();
        const users = await db.user.findMany({
          where: { emailReminders: true },
          orderBy: { id: "asc" },
          take: PAGE,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          select: { id: true, timeZone: true, lastReminderOn: true },
        });
        const due = users.flatMap((u) => {
          const r = shouldRemindNow(
            { timeZone: u.timeZone, lastReminderOn: u.lastReminderOn ? dateColumnToDay(u.lastReminderOn) : null },
            now,
          );
          return r.due ? [{ userId: u.id, day: r.day }] : [];
        });
        return { due, last: users.at(-1)?.id ?? null, full: users.length === PAGE };
      });
      if (batch.due.length) {
        await step.sendEvent(
          `queue-${page}`,
          batch.due.map((d) => ({ id: `reminder-${d.userId}-${d.day}`, name: EVENTS.reminderSend, data: d })),
        );
        queued += batch.due.length;
      }
      if (!batch.full || !batch.last) break;
      cursor = batch.last;
    }
    return { queued };
  },
);

/** One user's reminder. Event id dedupes per day; Resend idempotency stops double sends. */
export const sendReminder = inngest.createFunction(
  {
    id: "reminders-send",
    triggers: [{ event: EVENTS.reminderSend }],
    retries: 3,
    // Resend's default API limit is a few requests per second.
    throttle: { limit: 2, period: "1s" },
  },
  async ({ event, step }) => {
    const { userId } = event.data as { userId: string; day: string };
    const res = await step.run("deliver", () => deliverReminder(userId));
    return { status: res.status };
  },
);
