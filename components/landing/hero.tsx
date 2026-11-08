import { FlipWords } from "@/components/aceternity/flip-words";
import { GridBackground } from "@/components/aceternity/grid-background";
import { InfiniteMovingCards } from "@/components/aceternity/infinite-moving-cards";
import { Spotlight } from "@/components/aceternity/spotlight";
import { VappiPal } from "@/components/pal/vappi-pal";
import { CtaButton, SignInCta } from "./auth-buttons";

const TOPICS = [
  { name: "Biology", color: "bg-space-green" },
  { name: "My business plan", color: "bg-space-blue" },
  { name: "Cooking", color: "bg-space-orange" },
  { name: "Work project", color: "bg-space-violet" },
  { name: "Spanish verbs", color: "bg-space-pink" },
  { name: "Driving test", color: "bg-space-teal" },
  { name: "Marketing course", color: "bg-space-red" },
  { name: "World history", color: "bg-space-slate" },
];

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-28 pb-14 sm:pt-36 sm:pb-20 lg:pt-40">
      <GridBackground />
      <Spotlight className="-top-40 left-0 text-fg md:-top-20 md:left-60" />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-10 px-5 sm:px-6 lg:grid-cols-[1.25fr_1fr] lg:gap-6">
        <div className="flex min-w-0 flex-col items-center text-center lg:items-start lg:text-start">
          <span className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface/80 px-3 py-1.5 text-xs font-medium text-fg-muted">
            <span className="size-1.5 rounded-full bg-success" />
            Only your files. Always the source page.
          </span>

          <h1 className="mt-6 bg-linear-to-b from-fg to-fg-muted bg-clip-text text-[2.5rem] leading-[1.08] font-extrabold tracking-tight text-balance text-transparent sm:text-6xl lg:text-7xl">
            Your AI pal for your own files
          </h1>

          <p className="mt-5 min-h-[2lh] text-xl font-medium text-fg-body sm:min-h-[1lh] sm:text-2xl">
            Upload anything, then{" "}
            <FlipWords words={["learn it.", "ask it.", "make something from it."]} className="font-bold text-fg" />
          </p>

          <p className="mt-4 max-w-xl text-base leading-relaxed text-fg-muted">
            PDFs, slides, Word files and photos of handwritten notes. Vappi reads them in a minute or two, then turns
            them into summaries, flashcards and quizzes, answers your questions with page links, and writes from them.
          </p>

          <div className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
            <CtaButton label="Get started free" className="w-full sm:w-auto" />
            <SignInCta className="w-full sm:w-auto" />
          </div>
          <p className="mt-3 text-xs text-fg-subtle">Free plan, no card needed.</p>
        </div>

        <div className="relative flex items-center justify-center">
          <div
            aria-hidden
            className="absolute size-56 rounded-full bg-space-violet/25 blur-3xl sm:size-72 lg:size-80"
          />
          <VappiPal
            mood="greeting"
            followPointer
            label="Vappi, your AI pal"
            size={240}
            className="relative size-44 sm:size-56 lg:size-64"
          />
        </div>
      </div>

      <div className="relative z-10 mx-auto mt-14 w-full max-w-6xl px-5 sm:mt-20 sm:px-6">
        <p className="text-center text-eyebrow font-semibold tracking-wider text-fg-subtle uppercase">
          A Space for any topic
        </p>
        <InfiniteMovingCards
          className="mt-4"
          items={TOPICS.map((t) => ({
            key: t.name,
            content: (
              <span className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface px-4 py-2 text-sm font-medium whitespace-nowrap text-fg-body">
                <span className={`size-2 rounded-full ${t.color}`} />
                {t.name}
              </span>
            ),
          }))}
        />
      </div>
    </section>
  );
}
