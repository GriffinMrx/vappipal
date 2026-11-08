import "server-only";

import { hasProAccess } from "@/lib/billing/access";
import { db } from "@/lib/db";
import { FREE_LIMITS, PRO_LIMITS, QUIZ_WINDOW_DAYS, type LimitKind } from "@/lib/plans";

export type LimitCheck = {
  allowed: boolean;
  /** null = unlimited (Pro). */
  limit: number | null;
  used: number;
  pro: boolean;
};

/**
 * Server-side free-plan check (AGENTS.md §7, §11). Call it before the action
 * and show `limit` + the upgrade option when `allowed` is false.
 * `adding` is how many items the action would add (e.g. new flashcards).
 */
export async function checkLimit(
  userId: string,
  kind: LimitKind,
  { adding = 1, now = new Date() }: { adding?: number; now?: Date } = {},
): Promise<LimitCheck> {
  const pro = await hasProAccess(userId, now);
  const limit = (pro ? PRO_LIMITS : FREE_LIMITS)[kind];
  const used = await countUsage(userId, kind, now);
  return { allowed: limit === null || used + adding <= limit, limit, used, pro };
}

function countUsage(userId: string, kind: LimitKind, now: Date): Promise<number> {
  switch (kind) {
    case "document":
      return db.document.count({ where: { userId } });
    case "flashcards":
      return db.flashcard.count({ where: { userId } });
    case "quiz":
      return db.usageEvent.count({
        where: {
          userId,
          kind: "QUIZ",
          createdAt: { gt: new Date(now.getTime() - QUIZ_WINDOW_DAYS * 86_400_000) },
        },
      });
  }
}
