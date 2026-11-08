// Plain helpers (no "use client") so server and client components can both call them.

/** Goal labels offered in the Space form; "Other" lets the user type their own. */
export const GOAL_PRESETS = ["Exam", "Presentation", "Deadline", "Launch"] as const;

export const GOAL_LABEL_MAX = 40;

/** The goal's display name: the label, or "Goal" when none was given. */
export const goalName = (label: string | null | undefined) => label?.trim() || "Goal";

/** Countdown phrase: "12 days until Presentation", "Exam tomorrow", "Deadline today". */
export function goalCountdown(daysLeft: number | null, label?: string | null) {
  const name = goalName(label);
  if (daysLeft === null) return "No goal date";
  if (daysLeft < 0) return `${name} date passed`;
  if (daysLeft === 0) return `${name} today`;
  if (daysLeft === 1) return `${name} tomorrow`;
  return `${daysLeft} days until ${name}`;
}
