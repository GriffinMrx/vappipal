/**
 * SM-2 spaced repetition (AGENTS.md §7). Pure: the server applies it to the
 * STORED card values; the UI uses it only to label the grade buttons.
 */

export const GRADES = ["again", "hard", "good", "easy"] as const;
export type Grade = (typeof GRADES)[number];

const QUALITY: Record<Grade, number> = { again: 1, hard: 3, good: 4, easy: 5 };

/** "Again" shows the card again soon, in the same session. */
export const RELEARN_MINUTES = 10;
export const MIN_EASE = 1.3;

export type CardState = { ease: number; intervalDays: number; repetitions: number; lapses: number };

export type Scheduled = CardState & {
  nextReviewAt: Date;
  /** For labels: minutes when relearning, otherwise days. */
  dueIn: { minutes: number } | { days: number };
};

export function schedule(card: CardState, grade: Grade, now: Date = new Date()): Scheduled {
  const q = QUALITY[grade];
  const ease = Math.max(MIN_EASE, round2(card.ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  if (grade === "again") {
    return {
      ease,
      intervalDays: 0,
      repetitions: 0,
      lapses: card.repetitions > 0 ? card.lapses + 1 : card.lapses,
      nextReviewAt: new Date(now.getTime() + RELEARN_MINUTES * 60_000),
      dueIn: { minutes: RELEARN_MINUTES },
    };
  }

  const repetitions = card.repetitions + 1;
  let interval: number;
  if (repetitions === 1) interval = 1;
  else if (repetitions === 2) interval = grade === "hard" ? 3 : 6;
  else interval = Math.round(Math.max(1, card.intervalDays) * (grade === "hard" ? 1.2 : ease));
  if (grade === "easy") interval = Math.round(interval * 1.3);
  interval = Math.max(1, interval);

  return {
    ease,
    intervalDays: interval,
    repetitions,
    lapses: card.lapses,
    nextReviewAt: new Date(now.getTime() + interval * 86_400_000),
    dueIn: { days: interval },
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** "<10 min", "1 d", "2 mo" for the grade buttons. */
export function formatDueIn(d: Scheduled["dueIn"]): string {
  if ("minutes" in d) return `<${d.minutes} min`;
  if (d.days < 30) return `${d.days} d`;
  if (d.days < 365) return `${Math.round(d.days / 30)} mo`;
  return `${(d.days / 365).toFixed(1).replace(/\.0$/, "")} y`;
}
