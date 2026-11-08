import "server-only";

import { db } from "@/lib/db";
import type { SubscriptionStatus } from "@/lib/generated/prisma/enums";
import { PASS_DAYS } from "@/lib/plans";
import { hasProAccess } from "./access";
import { passEnd } from "./rules";

/**
 * The ONLY code that changes billing state. Today the mock checkout calls it;
 * later the Lemon Squeezy webhook will call exactly these (AGENTS.md §5: only
 * the payment provider's confirmation changes a plan).
 */

export type ProPlan = "pro_monthly" | "pro_yearly";

export async function applySubscription(input: {
  userId: string;
  externalId: string;
  plan: ProPlan;
  variantId: string;
  status: SubscriptionStatus;
  renewsAt: Date | null;
  endsAt: Date | null;
  testMode: boolean;
}) {
  const data = {
    kind: "SUBSCRIPTION" as const,
    variantId: input.variantId,
    status: input.status,
    renewsAt: input.renewsAt,
    endsAt: input.endsAt,
    testMode: input.testMode,
  };
  await db.subscription.upsert({
    where: { lemonSqueezyId: input.externalId },
    create: { userId: input.userId, lemonSqueezyId: input.externalId, ...data },
    update: data,
  });
  await syncPlanCache(input.userId);
}

/** A paid 30-Day Pass order: Pro for PASS_DAYS, extending any active pass. */
export async function applyOrder(input: {
  userId: string;
  externalId: string;
  variantId: string;
  paidAt: Date;
  testMode: boolean;
}) {
  const existing = await db.subscription.findUnique({ where: { lemonSqueezyId: input.externalId } });
  if (existing) return; // the same order twice changes nothing
  const active = await db.subscription.findFirst({
    where: { userId: input.userId, kind: "PASS", status: "PAID", testMode: input.testMode, endsAt: { gt: input.paidAt } },
    orderBy: { endsAt: "desc" },
    select: { endsAt: true },
  });
  await db.subscription.create({
    data: {
      userId: input.userId,
      lemonSqueezyId: input.externalId,
      kind: "PASS",
      variantId: input.variantId,
      status: "PAID",
      testMode: input.testMode,
      endsAt: passEnd(input.paidAt, active?.endsAt ?? null, PASS_DAYS),
    },
  });
  await syncPlanCache(input.userId);
}

export async function refundOrder(externalId: string) {
  const row = await db.subscription.findUnique({ where: { lemonSqueezyId: externalId }, select: { userId: true } });
  if (!row) return;
  await db.subscription.update({ where: { lemonSqueezyId: externalId }, data: { status: "REFUNDED" } });
  await syncPlanCache(row.userId);
}

/** User.plan is a display cache only; access always goes through hasProAccess. */
export async function syncPlanCache(userId: string) {
  const pro = await hasProAccess(userId);
  await db.user.update({ where: { id: userId }, data: { plan: pro ? "PRO" : "FREE" } });
}
