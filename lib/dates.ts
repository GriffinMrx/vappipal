/**
 * Calendar helpers that work in the STUDENT's time zone, never server time
 * (AGENTS.md §10/§12: Morocco switches between UTC+0 and UTC+1).
 * Calendar days are passed around as "YYYY-MM-DD" strings.
 */

/** "YYYY-MM-DD" of the given instant in `timeZone`. */
export function dayInZone(timeZone: string, at: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** Offset of `timeZone` from UTC at `at`, in milliseconds. */
function zoneOffsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** UTC instant of 00:00 on calendar day `day` in `timeZone`. */
export function startOfDayInZone(day: string, timeZone: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let instant = guess - zoneOffsetMs(timeZone, new Date(guess));
  // Re-check once in case a DST switch happens between the guess and midnight.
  instant = guess - zoneOffsetMs(timeZone, new Date(instant));
  return new Date(instant);
}

/** Calendar day after `day`. */
export function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** UTC instant when the user's current day ends (exclusive). */
export function endOfTodayInZone(timeZone: string, at: Date = new Date()): Date {
  return startOfDayInZone(nextDay(dayInZone(timeZone, at)), timeZone);
}

/** Whole calendar days from `from` to `to` (both "YYYY-MM-DD"). */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** A Postgres DATE column comes back as UTC midnight → "YYYY-MM-DD". */
export function dateColumnToDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → Date at UTC midnight, for writing a DATE column. */
export function dayToDateColumn(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

/** Hour (0–23) right now in `timeZone`. */
export function hourInZone(timeZone: string, at: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(at),
  );
}

export function isValidDay(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`));
}
