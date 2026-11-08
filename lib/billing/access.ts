import "server-only";

import { db } from "@/lib/db";
import { BILLING_TEST_MODE } from "@/lib/plans";
import type { SubscriptionStatus } from "@/lib/generated/prisma/enums";

/** Subscription statuses that still give Pro (until `endsAt`, if set). */
const ACTIVE_SUBSCRIPTION: SubscriptionStatus[] = ["ON_TRIAL", "ACTIVE", "PAST_DUE", "CANCELLED"];

/**
 * THE Pro check (AGENTS.md §7): an active Pro subscription, or a 30-Day Pass
 * that has not expired. Every limit is enforced on the server through this.
 * Only rows from the current billing mode (test vs live) count.
 */
export async function hasProAccess(userId: string, now: Date = new Date()): Promise<boolean> {
  const match = await db.subscription.findFirst({
    where: {
      userId,
      testMode: BILLING_TEST_MODE,
      OR: [
        {
          kind: "SUBSCRIPTION",
          status: { in: ACTIVE_SUBSCRIPTION },
          // Cancelled keeps access until the period ends; others until endsAt if set.
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          NOT: { status: "CANCELLED", endsAt: null },
        },
        { kind: "PASS", status: "PAID", endsAt: { gt: now } },
      ],
    },
    select: { id: true },
  });
  return match !== null;
}
