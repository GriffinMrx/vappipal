import "server-only";

import { dateColumnToDay, dayInZone, dayToDateColumn } from "@/lib/dates";
import { appUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { renderReminder } from "@/lib/email/reminder-template";
import { sendEmail, type SendResult } from "@/lib/email/send";
import { buildReminderContent } from "./content";

export { appUrl };

export type DeliverResult =
  | { status: "sent"; result: SendResult }
  | { status: "nothing-to-do" | "off" | "already-sent" | "missing" };

/**
 * Build and send one user's reminder for `day` (their calendar day).
 * Scheduled sends are once per day: Resend's idempotency key + lastReminderOn.
 * `test` sends now and doesn't count as today's reminder.
 */
export async function deliverReminder(userId: string, opts: { test?: boolean; now?: Date } = {}): Promise<DeliverResult> {
  const now = opts.now ?? new Date();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, timeZone: true, emailReminders: true, lastReminderOn: true, unsubscribeToken: true },
  });
  if (!user) return { status: "missing" };
  const day = dayInZone(user.timeZone, now);
  if (!opts.test) {
    if (!user.emailReminders) return { status: "off" };
    if (user.lastReminderOn && dateColumnToDay(user.lastReminderOn) === day) return { status: "already-sent" };
  }

  const content = await buildReminderContent(user.id, now);
  if (!content) return { status: "nothing-to-do" };

  const base = appUrl();
  const unsubscribe = `${base}/unsubscribe?token=${encodeURIComponent(user.unsubscribeToken)}`;
  const { subject, html, text } = renderReminder(content, {
    start: `${base}${content.pro ? "/planner" : "/home"}`,
    unsubscribe,
    settings: `${base}/settings`,
  });

  const result = await sendEmail({
    to: user.email,
    subject: opts.test ? `[Test] ${subject}` : subject,
    html,
    text,
    headers: {
      "List-Unsubscribe": `<${base}/api/unsubscribe?token=${encodeURIComponent(user.unsubscribeToken)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    idempotencyKey: opts.test ? `reminder-test/${user.id}/${now.getTime()}` : `reminder/${user.id}/${day}`,
    previewName: `${day}-${opts.test ? "test-" : ""}${user.id}`,
  });

  if (!opts.test && result.sent) {
    await db.user.update({ where: { id: user.id }, data: { lastReminderOn: dayToDateColumn(day) } });
  }
  return { status: "sent", result };
}
