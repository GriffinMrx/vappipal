"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import PixelCard from "@/components/ui/pixel-card";
import { useToast } from "@/components/ui/toast";
import { mockCheckout } from "@/lib/billing/actions";
import type { CheckoutPlan } from "@/lib/billing/types";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons/icon";
import { FlaskConical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

export type CurrentPlanKey = "free" | "pro_monthly" | "pro_yearly" | "pass";

type Props = {
  prices: { proMonthly: number; proYearly: number; pass: number; currency: string };
  freeLimits: { documents: number | null; flashcards: number | null; quizzes: number | null; creations: number };
  current: CurrentPlanKey;
  /** An active (not cancelled) subscription: Pro can't be bought again. */
  subscribed: boolean;
  mockAllowed: boolean;
};

type Feature = { text: string; icon: ReactNode };

/** Duotone icons from assets/icons. */
const duo = (name: IconName) => <Icon name={name} size={18} />;

const chatIcon = duo("bubble-chat");
const addDaysIcon = duo("add-event");

const PRO_FEATURES: Feature[] = [
  { text: "Unlimited uploads, flashcards and quizzes", icon: duo("rectagular-upload") },
  { text: "Ask your files, with page links", icon: chatIcon },
  { text: "Create notes, outlines, checklists, emails and blog posts", icon: duo("note") },
  { text: "Goal planner and daily plan", icon: duo("planner") },
];

/** Free · Pro (monthly/yearly) · 30-Day Pass. Buying goes through the mock checkout for now. */
export function PlanCards({ prices, freeLimits, current, subscribed, mockAllowed }: Props) {
  const [period, setPeriod] = useState<"monthly" | "yearly">(current === "pro_yearly" ? "yearly" : "monthly");
  const [checkout, setCheckout] = useState<CheckoutPlan | null>(null);
  const money = (n: number, digits = 0) =>
    new Intl.NumberFormat("en", { style: "currency", currency: prices.currency, maximumFractionDigits: digits }).format(n);
  const saving = Math.max(0, Math.round((1 - prices.proYearly / (prices.proMonthly * 12)) * 100));
  const proPlan: CheckoutPlan = period === "yearly" ? "pro_yearly" : "pro_monthly";
  const isCurrentPro = current === proPlan;
  const limit = (n: number | null, unit: string) => (n === null ? `Unlimited ${unit}` : `${n} ${unit}`);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Free */}
        <PlanCard
          name="Free"
          icon="stars"
          price={money(0)}
          per="forever"
          note="To try Vappi on your own files."
          features={[
            { text: limit(freeLimits.documents, "documents"), icon: duo("document") },
            { text: limit(freeLimits.flashcards, "flashcards"), icon: duo("layer") },
            { text: `${freeLimits.quizzes ?? "Unlimited"} quizzes a week`, icon: duo("checklist") },
            { text: `${freeLimits.creations} creations a week`, icon: duo("note") },
            { text: "Summaries with key terms", icon: duo("stars") },
          ]}
          current={current === "free"}
          action={
            <PlanButton disabled>{current === "free" ? "Your plan" : "Included"}</PlanButton>
          }
        />

        {/* Pro */}
        <PlanCard
          highlight
          name="Pro"
          icon="crown"
          price={period === "yearly" ? money(prices.proYearly) : money(prices.proMonthly)}
          per={period === "yearly" ? "a year" : "a month"}
          note={period === "yearly" ? `${money(prices.proYearly / 12, 2)} a month, billed yearly` : "Cancel anytime."}
          toggle={
            <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-pill bg-black/25 p-1">
              {(["monthly", "yearly"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={period === p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-1.5 rounded-pill px-3 text-xs font-semibold transition-colors lg:min-h-8",
                    period === p ? "bg-fg text-bg" : "text-accent-fg/80 hover:text-accent-fg",
                  )}
                >
                  {p === "monthly" ? "Monthly" : "Yearly"}
                  {p === "yearly" && saving > 0 && (
                    <span className={cn("rounded-pill px-1.5 text-[0.625rem]", period === p ? "bg-success/20 text-bg" : "bg-success/20 text-success")}>
                      −{saving}%
                    </span>
                  )}
                </button>
              ))}
            </div>
          }
          features={PRO_FEATURES}
          current={isCurrentPro}
          action={
            <PlanButton solid disabled={subscribed || !mockAllowed} onClick={() => setCheckout(proPlan)}>
              {isCurrentPro ? "Your plan" : subscribed ? "You have Pro" : `Get Pro ${period}`}
            </PlanButton>
          }
        />

        {/* 30-Day Pass */}
        <PlanCard
          name="30-Day Pass"
          icon="exam"
          price={money(prices.pass)}
          per="once"
          note="Pro for 30 days. Perfect for one goal, no subscription."
          features={[
            { text: "Everything in Pro for 30 days", icon: duo("crown") },
            { text: "Buy again to add 30 more days", icon: addDaysIcon },
            { text: "No renewal, nothing to cancel", icon: duo("credit-card") },
          ]}
          current={current === "pass"}
          action={
            <PlanButton disabled={!mockAllowed} onClick={() => setCheckout("pass")}>
              {current === "pass" ? "Add 30 days" : "Get the 30-Day Pass"}
            </PlanButton>
          }
        />
      </div>

      <MockCheckoutDialog plan={checkout} onClose={() => setCheckout(null)} price={checkout ? priceOf(checkout, prices, money) : ""} />
    </>
  );
}

function priceOf(plan: CheckoutPlan, prices: Props["prices"], money: (n: number) => string) {
  if (plan === "pro_yearly") return `${money(prices.proYearly)} a year`;
  if (plan === "pro_monthly") return `${money(prices.proMonthly)} a month`;
  return `${money(prices.pass)} once`;
}

/** Pixel colours from the design system: greys for Free, accent purples for Pro and the 30-Day Pass. */
const PIXELS = {
  free: { colors: ["#333333", "#707070", "#9d9d9d"], glow: "#707070", delay: 0 },
  pro: { colors: ["#f0e4f8", "#c4a8ff", "#8b5cf6"], glow: "#8b5cf6", delay: 120 },
  pass: { colors: ["#46356e", "#6b4f9c", "#b48cff"], glow: "#6b4f9c", delay: 240 },
} as const;

/**
 * The React Bits Pixel Card demo's button, in Vappi's colours: a "tile" key
 * (soft gradient, light rim, top highlight, drop shadow) or a solid light key
 * for the featured plan. Brightens on hover; 44px on touch, 40px from lg.
 */
function PlanButton({
  solid,
  disabled,
  onClick,
  children,
}: {
  solid?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-11 w-full items-center justify-center rounded-[10px] px-4 text-sm font-semibold [text-shadow:none] transition-[filter,opacity] duration-200 hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg/60 disabled:pointer-events-none disabled:opacity-55 lg:min-h-10",
        solid
          ? "bg-fg text-bg shadow-[0_6px_18px_-8px_rgb(0_0_0/0.6)] hover:brightness-95"
          : "bg-linear-to-b from-[#2f2f33] to-[#212124] text-fg shadow-[inset_0_0_0_1px_rgb(255_255_255/0.07),inset_0_1px_0_rgb(255_255_255/0.12),0_4px_10px_-4px_rgb(0_0_0/0.7)]",
      )}
    >
      {children}
    </button>
  );
}

/** The demo's small icon tile next to the plan name. */
function IconTile({ name, onAccent }: { name: IconName; onAccent?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-[10px]",
        onAccent
          ? "bg-white/12 text-accent-fg shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12),inset_0_1px_0_rgb(255_255_255/0.18)]"
          : "bg-linear-to-b from-[#2f2f33] to-[#212124] text-fg-body shadow-[inset_0_0_0_1px_rgb(255_255_255/0.07),inset_0_1px_0_rgb(255_255_255/0.12),0_4px_10px_-4px_rgb(0_0_0/0.7)]",
      )}
    >
      <Icon name={name} size={17} />
    </span>
  );
}

function PlanCard({
  name,
  icon,
  price,
  per,
  note,
  features,
  action,
  current,
  highlight,
  toggle,
}: {
  name: string;
  icon: IconName;
  price: string;
  per: string;
  note: string;
  features: Feature[];
  action: ReactNode;
  current?: boolean;
  highlight?: boolean;
  toggle?: ReactNode;
}) {
  const pixels = PIXELS[highlight ? "pro" : name === "Free" ? "free" : "pass"];
  return (
    <PixelCard
      // Our surfaces and palette; pixels light up on hover / focus inside, once on first view.
      surfaceClassName={
        highlight
          ? "bg-linear-to-b from-accent-top to-accent-bottom text-accent-fg shadow-[inset_0_0_0_1px_rgb(110_80_170/0.55),inset_0_1px_0_0_rgb(225_205_255/0.45),inset_0_-1px_0_0_rgb(200_165_255/0.8),0_14px_50px_-14px_rgb(120_60_220/0.6)]"
          : "bg-surface"
      }
      colors={[...pixels.colors]}
      glowColor={pixels.glow}
      gap={6}
      speed={30}
      pixelSize={2}
      fade={0.35}
      introDelay={pixels.delay}
      radius={12}
      focusable={false}
      className="h-full"
    >
      <div
        className={cn(
          "flex h-full flex-col gap-5 p-5 sm:p-6",
          // The demo's text halo: keeps text readable over lit pixels.
          highlight
            ? "[text-shadow:0_1px_2px_rgb(28_10_60/0.9),0_0_10px_rgb(40_14_90/0.7)]"
            : "[text-shadow:0_1px_2px_rgb(15_14_19/0.95),0_0_10px_rgb(15_14_19/0.9)]",
        )}
      >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn("flex items-center gap-2.5 text-base font-bold", highlight ? "text-accent-fg" : "text-fg")}>
          <IconTile name={icon} onAccent={highlight} />
          {name}
        </p>
        {current && (
          <span className={cn("rounded-pill px-2.5 py-1 text-[0.6875rem] font-bold", highlight ? "bg-black/25 text-accent-fg" : "bg-surface-active text-fg-body")}>
            Current plan
          </span>
        )}
      </div>
      {toggle}
      <div className="flex flex-col gap-1">
        <p className="flex items-baseline gap-1.5">
          <span className={cn("text-3xl font-bold tracking-tight", highlight ? "text-white" : "text-fg")}>{price}</span>
          <span className={cn("text-sm", highlight ? "text-accent-fg/75" : "text-fg-subtle")}>{per}</span>
        </p>
        <p className={cn("text-xs", highlight ? "text-accent-fg/75" : "text-fg-muted")}>{note}</p>
      </div>
      <ul className="flex flex-1 flex-col gap-2.5">
        {features.map((f) => (
          <li key={f.text} className={cn("flex items-start gap-2.5 text-sm", highlight ? "text-accent-fg" : "text-fg-body")}>
            <span aria-hidden className={cn("mt-px shrink-0", highlight ? "text-white" : "text-fg-muted")}>
              {f.icon}
            </span>
            {f.text}
          </li>
        ))}
      </ul>
      {action}
      </div>
    </PixelCard>
  );
}

const PLAN_NAME: Record<CheckoutPlan, string> = {
  pro_monthly: "Pro · monthly",
  pro_yearly: "Pro · yearly",
  pass: "30-Day Pass",
};

/** Stand-in for the Lemon Squeezy checkout until it's connected. Not optimistic. */
function MockCheckoutDialog({ plan, price, onClose }: { plan: CheckoutPlan | null; price: string; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [paying, setPaying] = useState(false);

  async function pay() {
    if (!plan) return;
    setPaying(true);
    try {
      const res = await mockCheckout({ plan });
      if (!res.ok) {
        toast({ tone: "error", title: "Payment not completed", description: res.error });
        return;
      }
      onClose();
      toast({ tone: "success", title: "You're on Pro", description: `${PLAN_NAME[plan]} is active.` });
      router.refresh();
    } catch {
      toast({ tone: "error", title: "Payment not completed", description: "Check your connection and try again." });
    } finally {
      setPaying(false);
    }
  }

  return (
    <Dialog
      open={plan !== null}
      onClose={() => !paying && onClose()}
      title="Checkout"
      description="Billing isn't connected yet, so this is a test payment."
      closeLabel="Close"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={paying}>
            Cancel
          </Button>
          <Button variant="accent" onClick={pay} loading={paying}>
            Pay {price.split(" ")[0]} (test)
          </Button>
        </>
      }
    >
      {plan && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 rounded-control border border-border bg-bg/40 px-4 py-3">
            <span className="text-sm font-semibold text-fg">{PLAN_NAME[plan]}</span>
            <span className="text-sm text-fg-body">{price}</span>
          </div>
          <p className="flex items-start gap-2 rounded-control bg-warning/10 px-3 py-2.5 text-xs text-warning">
            <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0" />
            Test payment: no money is charged and no card is needed.
          </p>
        </div>
      )}
    </Dialog>
  );
}
