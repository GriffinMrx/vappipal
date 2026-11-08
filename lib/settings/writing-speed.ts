// Plain module (shared by server and client): how fast Vappi types in the
// Create editor, chosen in Settings.

import type { WritingSpeed } from "@/lib/generated/prisma/enums";

export type { WritingSpeed };

export type Pace = { cps: number; catchUpS: number };

export const WRITING_SPEEDS: Record<WritingSpeed, { label: string; hint: string; pace: Pace }> = {
  CALM: { label: "Calm", hint: "Slow, to enjoy the pal", pace: { cps: 25, catchUpS: 40 } },
  NORMAL: { label: "Normal", hint: "Steady, word by word", pace: { cps: 45, catchUpS: 25 } },
  FAST: { label: "Fast", hint: "Quick, still animated", pace: { cps: 110, catchUpS: 10 } },
  INSTANT: { label: "Instant", hint: "No typing animation", pace: { cps: Infinity, catchUpS: 0 } },
};

export const WRITING_SPEED_KEYS = Object.keys(WRITING_SPEEDS) as WritingSpeed[];
