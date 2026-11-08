import { HoverEffect } from "@/components/aceternity/card-hover-effect";
import { Icon, type IconName } from "@/components/icons/icon";
import { cn } from "@/lib/cn";
import { CtaButton } from "./auth-buttons";
import { SectionIntro } from "./section-intro";

export type LandingPrices = { proMonthly: number; proYearly: number; pass: number; currency: string };
export type LandingFreeLimits = { documents: number | null; flashcards: number | null; quizzes: number | null; creations: number };

type Plan = {
  key: string;
  name: string;
  icon: IconName;
  price: string;
  per: string;
  note: string;
  features: string[];
  cta: { label: string; signedInLabel: string; signedInHref: string };
  highlight?: boolean;
};

/** Free · Pro · 30-Day Pass. Prices and limits come from env through lib/plans.ts. */
export function Pricing({ prices, freeLimits }: { prices: LandingPrices; freeLimits: LandingFreeLimits }) {
  const money = (n: number, digits = 0) =>
    new Intl.NumberFormat("en", { style: "currency", currency: prices.currency, maximumFractionDigits: digits }).format(n);
  const limit = (n: number | null, unit: string) => (n === null ? `Unlimited ${unit}` : `${n} ${unit}`);
  const saving = Math.max(0, Math.round((1 - prices.proYearly / (prices.proMonthly * 12)) * 100));

  const plans: Plan[] = [
    {
      key: "free",
      name: "Free",
      icon: "stars",
      price: money(0),
      per: "forever",
      note: "To try Vappi on your own files.",
      features: [
        limit(freeLimits.documents, "documents"),
        limit(freeLimits.flashcards, "flashcards"),
        `${freeLimits.quizzes ?? "Unlimited"} quizzes a week`,
        `${freeLimits.creations} creations a week`,
        "Summaries with key terms",
      ],
      cta: { label: "Start free", signedInLabel: "Open Vappi", signedInHref: "/home" },
    },
    {
      key: "pro",
      name: "Pro",
      icon: "crown",
      price: money(prices.proMonthly),
      per: "a month",
      note: `Or ${money(prices.proYearly)} a year${saving > 0 ? `, save ${saving}%` : ""}. Cancel anytime.`,
      features: [
        "Unlimited uploads, flashcards and quizzes",
        "Ask your files, with page links",
        "Create notes, outlines, checklists, emails and blog posts",
        "Goal planner and daily plan",
      ],
      cta: { label: "Get Pro", signedInLabel: "Get Pro", signedInHref: "/billing" },
      highlight: true,
    },
    {
      key: "pass",
      name: "30-Day Pass",
      icon: "exam",
      price: money(prices.pass),
      per: "once",
      note: "Pro for 30 days. Perfect for one goal, no subscription.",
      features: ["Everything in Pro for 30 days", "Buy again to add 30 more days", "No renewal, nothing to cancel"],
      cta: { label: "Get the 30-Day Pass", signedInLabel: "Get the 30-Day Pass", signedInHref: "/billing" },
    },
  ];

  return (
    <section id="pricing" className="scroll-mt-24 px-5 py-16 sm:px-6 sm:py-24">
      <SectionIntro
        eyebrow="Pricing"
        title="Start free. Go Pro when you need more."
        text="Pay monthly, yearly, or just once for the 30 days before a goal."
      />
      <HoverEffect
        className="mx-auto mt-10 w-full max-w-6xl"
        items={plans.map((p) => ({ key: p.key, content: <PlanCard plan={p} /> }))}
      />
    </section>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-card border p-5 sm:p-6",
        plan.highlight
          ? "border-accent-edge bg-linear-to-b from-accent-top to-bg shadow-[inset_0_1px_0_0_var(--color-accent-rim)]"
          : "border-border bg-surface",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("flex items-center gap-2 text-base font-bold", plan.highlight ? "text-accent-fg" : "text-fg")}>
          <Icon name={plan.icon} size={20} />
          {plan.name}
        </span>
        {plan.highlight && (
          <span className="rounded-pill bg-fg px-2.5 py-1 text-eyebrow font-bold text-bg">Most popular</span>
        )}
      </div>
      <p className="mt-5 flex items-baseline gap-1.5">
        <span className="text-4xl font-extrabold tracking-tight text-fg">{plan.price}</span>
        <span className="text-sm text-fg-muted">{plan.per}</span>
      </p>
      <p className="mt-2 text-sm text-fg-muted">{plan.note}</p>
      <ul className="mt-6 flex flex-1 flex-col gap-3 border-t border-border pt-6">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2.5 text-sm text-fg-body">
            <span aria-hidden className={cn("mt-2 size-1.5 shrink-0 rounded-full", plan.highlight ? "bg-accent-fg" : "bg-fg-subtle")} />
            {f}
          </li>
        ))}
      </ul>
      <CtaButton
        className="mt-6 w-full"
        variant={plan.highlight ? "primary" : "subtle"}
        arrow={false}
        label={plan.cta.label}
        signedInLabel={plan.cta.signedInLabel}
        signedInHref={plan.cta.signedInHref}
      />
    </div>
  );
}
