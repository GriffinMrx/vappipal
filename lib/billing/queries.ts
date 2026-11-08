import "server-only";

import { creationAllowance } from "@/lib/creations/queries";
import { db } from "@/lib/db";
import { checkLimit } from "@/lib/limits";
import { BILLING, BILLING_TEST_MODE, PRICES, VARIANTS } from "@/lib/plans";
import type { PlanState } from "./rules";

const LIVE_SUB = ["ON_TRIAL", "ACTIVE", "PAST_DUE", "CANCELLED"] as const;

const isYearly = (variantId: string) => variantId === "mock-pro-yearly" || (!!VARIANTS.proYearly && variantId === VARIANTS.proYearly);

/** The user's current plan, as the billing page shows it (same rules as hasProAccess). */
export async function getPlanState(userId: string, now = new Date()): Promise<PlanState> {
  const sub = await db.subscription.findFirst({
    where: {
      userId,
      kind: "SUBSCRIPTION",
      testMode: BILLING_TEST_MODE,
      status: { in: [...LIVE_SUB] },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      NOT: { status: "CANCELLED", endsAt: null },
    },
    orderBy: { createdAt: "desc" },
  });
  if (sub) {
    return {
      kind: "subscription",
      plan: isYearly(sub.variantId) ? "pro_yearly" : "pro_monthly",
      status: sub.status === "CANCELLED" ? "cancelled" : sub.status === "PAST_DUE" ? "past_due" : "active",
      until: sub.status === "CANCELLED" ? sub.endsAt : sub.renewsAt,
    };
  }
  const pass = await db.subscription.findFirst({
    where: { userId, kind: "PASS", status: "PAID", testMode: BILLING_TEST_MODE },
    orderBy: { endsAt: "desc" },
    select: { endsAt: true },
  });
  if (pass?.endsAt && pass.endsAt > now) return { kind: "pass", until: pass.endsAt };
  if (pass?.endsAt && now.getTime() - pass.endsAt.getTime() < 30 * 86_400_000) return { kind: "pass_expired", endedAt: pass.endsAt };
  return { kind: "free" };
}

export async function getBillingView(userId: string) {
  const [state, documents, flashcards, quizzes, creations] = await Promise.all([
    getPlanState(userId),
    checkLimit(userId, "document", { adding: 0 }),
    checkLimit(userId, "flashcards", { adding: 0 }),
    checkLimit(userId, "quiz", { adding: 0 }),
    creationAllowance(userId),
  ]);
  return {
    state,
    pro: documents.pro,
    usage: { documents, flashcards, quizzes, creations },
    prices: PRICES,
    mock: BILLING.provider === "mock",
    mockAllowed: BILLING.mockAllowed,
  };
}

export type BillingView = Awaited<ReturnType<typeof getBillingView>>;
