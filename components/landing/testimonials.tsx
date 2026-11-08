import { BentoGrid, bentoCardClasses } from "@/components/aceternity/bento-grid";
import { GridBackground } from "@/components/aceternity/grid-background";
import { LetterChip, spaceDot, type SpaceColor } from "@/components/ui/letter-chip";
import { cn } from "@/lib/cn";
import { Star } from "lucide-react";
import { SectionIntro } from "./section-intro";

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  space: string;
  color: SpaceColor;
  /** Bento spans per breakpoint. */
  className?: string;
  featured?: boolean;
};

/*
 * PLACEHOLDER testimonials (prompt 45). These are not real customers.
 * Replace them with real, permitted quotes — or remove this section — before
 * the site goes live: fake reviews shown as genuine are illegal in many places.
 */
const TESTIMONIALS: Testimonial[] = [
  {
    featured: true,
    className: "md:col-span-2",
    quote:
      "I dropped in a whole semester of lecture slides and had summaries and flashcards the same evening. The page links are the best part: when a card confuses me, I open the exact slide it came from.",
    name: "Amara O.",
    role: "Nursing student",
    space: "Anatomy",
    color: "green",
  },
  {
    quote:
      "I set my exam date and Vappi gave me a plan for every day until then. Twenty cards and one quiz a day felt doable, so I actually kept going. The last three days were pure review, exactly what I needed.",
    name: "Lukas M.",
    role: "Law student",
    space: "Contract law",
    color: "blue",
  },
  {
    quote: "I asked about my own business plan and it answered with the page numbers. When something wasn't in the plan, it said so.",
    name: "Priya S.",
    role: "Founder",
    space: "Business plan",
    color: "violet",
  },
  {
    quote: "Photos of my handwritten notes turned into quizzes. My handwriting is terrible, and it still worked.",
    name: "Diego R.",
    role: "High school student",
    space: "Chemistry",
    color: "orange",
  },
  {
    quote: "I turn meeting docs into a short email for my manager in seconds, and it lists the pages it used.",
    name: "Hannah K.",
    role: "Project manager",
    space: "Work project",
    color: "teal",
  },
  {
    className: "md:col-span-2",
    quote:
      "Most AI tools make things up. Vappi sticks to my course readings and shows me where every answer came from, which is the only way I'd trust it before an exam.",
    name: "Yuki T.",
    role: "History student",
    space: "World history",
    color: "red",
  },
  {
    className: "md:col-span-2 lg:col-span-1",
    quote: "I uploaded my grandmother's recipe scans and made a shopping checklist from them. Small thing, but I love it.",
    name: "Sam T.",
    role: "Home cook",
    space: "Cooking",
    color: "pink",
  },
];

function Stars() {
  return (
    <div role="img" aria-label="5 out of 5" className="flex gap-0.5 text-warning">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={14} fill="currentColor" strokeWidth={0} aria-hidden />
      ))}
    </div>
  );
}

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <figure
      className={cn(
        "group/bento relative flex min-w-0 flex-col justify-between gap-6 overflow-hidden p-6 sm:p-8",
        t.featured
          ? "rounded-xl border border-accent-edge shadow-bento bg-linear-to-br from-accent-top to-surface hover:border-accent-rim"
          : bentoCardClasses,
        t.className,
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Stars />
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-bg/60 px-2.5 py-1 text-eyebrow font-semibold text-fg-muted">
            <span className={cn("size-1.5 rounded-full", spaceDot[t.color])} />
            {t.space}
          </span>
        </div>
        <blockquote
          className={cn(
            "leading-relaxed text-pretty break-words",
            t.featured ? "text-lg font-medium text-fg sm:text-xl" : "text-sm text-fg-body sm:text-base",
          )}
        >
          &ldquo;{t.quote}&rdquo;
        </blockquote>
      </div>
      <figcaption className="flex min-w-0 items-center gap-3">
        <LetterChip name={t.name} color={t.color} className="size-10 rounded-full text-sm" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-fg">{t.name}</span>
          <span className="block truncate text-xs text-fg-muted">{t.role}</span>
        </span>
      </figcaption>
    </figure>
  );
}

export function Testimonials() {
  return (
    <section id="reviews" className="relative scroll-mt-24 overflow-hidden px-5 py-16 sm:px-6 sm:py-24">
      <GridBackground variant="dot" />
      <div className="relative z-10">
        <SectionIntro
          eyebrow="Reviews"
          title="People learn, ask and make more with Vappi"
          text="Students, workers and hobbyists use their own files, and every answer shows the page."
        />
        <BentoGrid className="mt-12 md:auto-rows-[minmax(14rem,auto)]">
          {TESTIMONIALS.map((t) => (
            <TestimonialCard key={t.name} t={t} />
          ))}
        </BentoGrid>
      </div>
    </section>
  );
}
