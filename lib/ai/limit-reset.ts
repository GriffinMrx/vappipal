/**
 * When the AI provider's daily quota resets, and the user-facing sentence for it.
 * Pure (no DB, no secrets), so it can be unit-checked in Node. The reset moment
 * comes from env (Gemini free tier: midnight Pacific time), never hardcoded, and
 * is shown in the USER's time zone (AGENTS.md §12: never server time).
 */

import { dayInZone, nextDay, startOfDayInZone } from "@/lib/dates";
import { AI_DAILY_LIMIT_MESSAGE, AI_LIMIT_HEAD, AI_LIMIT_RESET_MESSAGE } from "./messages";

const HOUR_MS = 3_600_000;

function validZone(tz: string | undefined, fallback: string): string {
  if (!tz) return fallback;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return fallback;
  }
}

function resetConfig() {
  const hour = Number.parseInt(process.env.AI_LIMIT_RESET_HOUR ?? "", 10);
  return {
    tz: validZone(process.env.AI_LIMIT_RESET_TZ, "America/Los_Angeles"),
    hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 0,
  };
}

function prevDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/** The reset moment on calendar `day` of the provider's time zone. */
function resetOn(day: string): Date {
  const { tz, hour } = resetConfig();
  return new Date(startOfDayInZone(day, tz).getTime() + hour * HOUR_MS);
}

/** The next moment the daily limit resets (strictly after `now`). */
export function nextAiReset(now: Date = new Date()): Date {
  const today = dayInZone(resetConfig().tz, now);
  const r = resetOn(today);
  return r > now ? r : resetOn(nextDay(today));
}

/** The most recent reset at or before `now`. */
export function lastAiReset(now: Date = new Date()): Date {
  const today = dayInZone(resetConfig().tz, now);
  const r = resetOn(today);
  return r <= now ? r : resetOn(prevDay(today));
}

function duration(ms: number): string {
  const mins = Math.max(1, Math.ceil(ms / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * "Vappi's AI has reached its daily limit. It resets at 9:00 AM (in 3 h 20 min)."
 * With `failedAt` (a stored failure) from before the last reset → "…has reset. Press Try again."
 */
export function aiLimitMessage(userTimeZone: string | null | undefined, now: Date = new Date(), failedAt?: Date | null): string {
  if (failedAt && failedAt < lastAiReset(now)) return AI_LIMIT_RESET_MESSAGE;
  const tz = validZone(userTimeZone ?? undefined, "UTC");
  const reset = nextAiReset(now);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(reset);
  const when = dayInZone(tz, reset) === dayInZone(tz, now) ? `at ${time}` : `tomorrow at ${time}`;
  return `${AI_LIMIT_HEAD} It resets ${when} (in ${duration(reset.getTime() - now.getTime())}).`;
}

/** A stored message → what to show now (only the limit marker is rewritten). */
export function showStoredMessage(
  message: string | null,
  userTimeZone: string | null | undefined,
  failedAt: Date | null | undefined,
  now: Date = new Date(),
): string | null {
  return message === AI_DAILY_LIMIT_MESSAGE ? aiLimitMessage(userTimeZone, now, failedAt ?? null) : message;
}
