/** Pure billing rules (unit-tested). */

const DAY = 86_400_000;

/** A new pass starts when the current one ends (if still active), else now. */
export function passEnd(paidAt: Date, activeEndsAt: Date | null, days: number): Date {
  const start = activeEndsAt && activeEndsAt > paidAt ? activeEndsAt : paidAt;
  return new Date(start.getTime() + days * DAY);
}

/** Calendar month / year ahead, clamped to the month's last day (31 Jan → 28/29 Feb). */
export function addPeriod(from: Date, period: "month" | "year"): Date {
  const d = new Date(from);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  if (period === "month") d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

export type PlanState =
  | { kind: "free" }
  | { kind: "subscription"; plan: "pro_monthly" | "pro_yearly"; status: "active" | "cancelled" | "past_due"; until: Date | null }
  | { kind: "pass"; until: Date }
  | { kind: "pass_expired"; endedAt: Date };
