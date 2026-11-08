"use server";

import { getCurrentDbUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { BILLING } from "@/lib/plans";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { applyOrder, applySubscription, syncPlanCache } from "./apply";
import { getPlanState } from "./queries";
import { addPeriod } from "./rules";

export type BillingResult = { ok: true } | { ok: false; error: string };

const MOCK_REFUSED = "Test payments are turned off here. Billing isn't connected yet.";
let seq = 0;
const mockId = (kind: string) => `mock-${kind}-${Date.now().toString(36)}-${(++seq).toString(36)}`;

/** MOCK checkout (until Lemon Squeezy is connected): "pays" and applies the plan like the webhook will. */
export async function mockCheckout(input: { plan: "pro_monthly" | "pro_yearly" | "pass" }): Promise<BillingResult> {
  const user = await getCurrentDbUser();
  if (!BILLING.mockAllowed) return { ok: false, error: MOCK_REFUSED };
  const parsed = z.object({ plan: z.enum(["pro_monthly", "pro_yearly", "pass"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a plan." };
  const { plan } = parsed.data;
  const now = new Date();

  if (plan === "pass") {
    await applyOrder({ userId: user.id, externalId: mockId("order"), variantId: "mock-pass", paidAt: now, testMode: true });
  } else {
    const state = await getPlanState(user.id, now);
    if (state.kind === "subscription" && state.status !== "cancelled") {
      return { ok: false, error: "You already have Pro. Manage it from your current plan." };
    }
    // A cancelled subscription being replaced ends now.
    await db.subscription.updateMany({
      where: { userId: user.id, kind: "SUBSCRIPTION", status: "CANCELLED", testMode: true },
      data: { status: "EXPIRED", endsAt: now },
    });
    await applySubscription({
      userId: user.id,
      externalId: mockId("sub"),
      plan,
      variantId: plan === "pro_yearly" ? "mock-pro-yearly" : "mock-pro-monthly",
      status: "ACTIVE",
      renewsAt: addPeriod(now, plan === "pro_yearly" ? "year" : "month"),
      endsAt: null,
      testMode: true,
    });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

async function latestMockSubscription(userId: string) {
  return db.subscription.findFirst({
    where: { userId, kind: "SUBSCRIPTION", testMode: true, status: { in: ["ACTIVE", "CANCELLED", "ON_TRIAL", "PAST_DUE"] } },
    orderBy: { createdAt: "desc" },
  });
}

/** MOCK "Manage billing": cancel (Pro stays until the renewal date), resume, or end now. */
export async function mockManage(input: { action: "cancel" | "resume" | "end_now" }): Promise<BillingResult> {
  const user = await getCurrentDbUser();
  if (!BILLING.mockAllowed) return { ok: false, error: MOCK_REFUSED };
  const parsed = z.object({ action: z.enum(["cancel", "resume", "end_now"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown action." };
  const now = new Date();
  const sub = await latestMockSubscription(user.id);

  if (parsed.data.action === "end_now") {
    // Subscriptions expire; a 30-Day Pass stays a paid order whose time is up.
    await db.subscription.updateMany({
      where: { userId: user.id, testMode: true, kind: "SUBSCRIPTION", status: { in: ["ACTIVE", "CANCELLED", "ON_TRIAL", "PAST_DUE"] } },
      data: { status: "EXPIRED", endsAt: now },
    });
    await db.subscription.updateMany({
      where: { userId: user.id, testMode: true, kind: "PASS", status: "PAID", endsAt: { gt: now } },
      data: { endsAt: now },
    });
    await syncPlanCache(user.id);
  } else {
    if (!sub) return { ok: false, error: "There's no subscription to change." };
    const cancel = parsed.data.action === "cancel";
    await applySubscription({
      userId: user.id,
      externalId: sub.lemonSqueezyId,
      plan: sub.variantId === "mock-pro-yearly" ? "pro_yearly" : "pro_monthly",
      variantId: sub.variantId,
      status: cancel ? "CANCELLED" : "ACTIVE",
      renewsAt: sub.renewsAt,
      endsAt: cancel ? sub.renewsAt : null,
      testMode: true,
    });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
