import { goalText, summaryLine, type ReminderContent } from "@/lib/reminders/rules";

import { buttonRow, card, cardsRow, emailShell, esc, introRow } from "./layout";

/** The daily reminder email (shared layout in ./layout.ts). Space names and counts only. */

function taskLine(s: ReminderContent["spaces"][number]) {
  const parts = [
    s.read ? `Read ${s.read} summar${s.read === 1 ? "y" : "ies"}` : null,
    s.cards ? `Review ${s.cards} flashcard${s.cards === 1 ? "" : "s"}` : null,
    s.quiz ? "Take a quiz" : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function renderReminder(
  content: ReminderContent,
  urls: { start: string; unsubscribe: string; settings: string },
): { subject: string; html: string; text: string } {
  const line = summaryLine(content.totals) ?? "your plan";
  const subject = `Today: ${line}`;

  const cards = content.spaces.map((s) => card(s.name, taskLine(s), goalText(s.daysLeft, s.goalLabel))).join("");

  const html = emailShell({
    title: subject,
    preheader: `Hi ${content.firstName}, ${line} today.`,
    rows:
      introRow(`Hi ${content.firstName}, here's today`, `${line.charAt(0).toUpperCase() + line.slice(1)}.`) +
      cardsRow(cards) +
      buttonRow(urls.start, "Open Vappi"),
    footer: `You get this because daily reminders are on.<br>
        <a href="${esc(urls.unsubscribe)}" style="color:#4b4b52">Unsubscribe</a> · <a href="${esc(urls.settings)}" style="color:#4b4b52">Manage in Settings</a>`,
  });

  const text = [
    `Hi ${content.firstName}, here's today: ${line}.`,
    "",
    ...content.spaces.map((s) => `• ${s.name}: ${taskLine(s)}${goalText(s.daysLeft, s.goalLabel) ? ` (${goalText(s.daysLeft, s.goalLabel)})` : ""}`),
    "",
    `Open Vappi: ${urls.start}`,
    "",
    `You get this because daily reminders are on. Unsubscribe: ${urls.unsubscribe}`,
  ].join("\n");

  return { subject, html, text };
}
