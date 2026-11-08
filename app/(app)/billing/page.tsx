import { CurrentPlan } from "@/components/billing/current-plan";
import { PlanCards, type CurrentPlanKey } from "@/components/billing/plan-cards";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentDbUser } from "@/lib/auth/current-user";
import { getBillingView } from "@/lib/billing/queries";
import type { PlanState } from "@/lib/billing/rules";
import { FREE_CREATIONS_PER_WEEK, FREE_LIMITS } from "@/lib/plans";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Billing · Vappi" };

/** Plans and the user's current plan. Payments are mocked until Lemon Squeezy is connected. */
export default async function BillingPage() {
  const user = await getCurrentDbUser();
  const view = await getBillingView(user.id);
  const day = (d: Date | null) =>
    d ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: user.timeZone }).format(d) : "";
  const { title, detail, warning, current, subscribed, manage } = describe(view.state, view.pro, day);

  return (
    <>
      <PageHeader eyebrow="Account" title="Billing" />
      <div className="mt-8 flex flex-col gap-8">
        <CurrentPlan
          title={title}
          detail={detail}
          warning={warning}
          pro={view.pro}
          mockAllowed={view.mockAllowed}
          manage={manage}
          usage={[
            { label: "Documents", used: view.usage.documents.used, limit: view.usage.documents.limit },
            { label: "Flashcards", used: view.usage.flashcards.used, limit: view.usage.flashcards.limit },
            { label: "Quizzes this week", used: view.usage.quizzes.used, limit: view.usage.quizzes.limit },
            { label: "Creations this week", used: view.usage.creations.used, limit: view.usage.creations.limit },
          ]}
        />
        <section className="flex flex-col gap-3.5">
          <h2 className="text-lg font-medium text-fg-body">Plans</h2>
          <PlanCards
            prices={view.prices}
            freeLimits={{ documents: FREE_LIMITS.document, flashcards: FREE_LIMITS.flashcards, quizzes: FREE_LIMITS.quiz, creations: FREE_CREATIONS_PER_WEEK }}
            current={current}
            subscribed={subscribed}
            mockAllowed={view.mockAllowed}
          />
          {view.mock && (
            <p className="text-xs text-fg-subtle">
              {view.mockAllowed
                ? "Payments are in test mode: buying a plan here charges nothing."
                : "Payments aren't available yet."}
            </p>
          )}
        </section>
      </div>
    </>
  );
}

function describe(state: PlanState, pro: boolean, day: (d: Date | null) => string) {
  const none = { cancel: false, resume: false, endNow: false };
  switch (state.kind) {
    case "subscription": {
      const name = state.plan === "pro_yearly" ? "Pro · yearly" : "Pro · monthly";
      if (state.status === "cancelled")
        return {
          title: name,
          detail: `Cancelled. Pro stays active until ${day(state.until)}.`,
          current: state.plan as CurrentPlanKey,
          subscribed: false,
          manage: { cancel: false, resume: true, endNow: true },
        };
      return {
        title: name,
        detail: state.until ? `Renews on ${day(state.until)}.` : "Active.",
        warning: state.status === "past_due" ? "Your last payment failed. Update your card to keep Pro." : undefined,
        current: state.plan as CurrentPlanKey,
        subscribed: true,
        manage: { cancel: true, resume: false, endNow: true },
      };
    }
    case "pass": {
      const left = Math.max(1, Math.ceil((state.until.getTime() - Date.now()) / 86_400_000));
      return {
        title: "30-Day Pass",
        detail: `Active until ${day(state.until)} (${left} day${left === 1 ? "" : "s"} left).`,
        current: "pass" as const,
        subscribed: false,
        manage: { ...none, endNow: true },
      };
    }
    case "pass_expired":
      return {
        title: "Free",
        detail: `Your 30-Day Pass ended on ${day(state.endedAt)}.`,
        current: "free" as const,
        subscribed: false,
        manage: none,
      };
    default:
      return {
        title: pro ? "Pro" : "Free",
        detail: pro ? "Pro access is active." : "Upgrade for unlimited uploads, Ask, Create and the goal planner.",
        current: "free" as const,
        subscribed: false,
        manage: pro ? { ...none, endNow: true } : none,
      };
  }
}
