import { BackgroundBeams } from "@/components/aceternity/background-beams";
import { Check } from "lucide-react";

const POINTS = [
  { title: "Only your files", text: "Vappi never adds facts from outside the files in your Space." },
  { title: "Every answer shows its pages", text: "Summaries, cards, quizzes, chat and creations all link to the source page." },
  { title: "Private by default", text: "Your files and everything made from them stay yours. No public links." },
];

export function SourceBand() {
  return (
    <section className="px-5 py-8 sm:px-6">
      <div className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[1.5rem] border border-border bg-bg-sidebar px-5 py-14 sm:px-10 sm:py-20">
        <BackgroundBeams />
        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
          <h2 className="bg-linear-to-b from-fg to-fg-muted bg-clip-text text-3xl leading-tight font-extrabold tracking-tight text-balance text-transparent sm:text-5xl">
            Only your files. Always the source.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-fg-muted">
            When your files don&apos;t have the answer, Vappi says so instead of guessing.
          </p>
        </div>
        <ul className="relative z-10 mx-auto mt-10 grid max-w-5xl gap-3 sm:mt-12 md:grid-cols-3">
          {POINTS.map((p) => (
            <li key={p.title} className="flex gap-3 rounded-card border border-border bg-surface/70 p-4 backdrop-blur-sm sm:p-5">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                <Check size={14} strokeWidth={3} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-fg">{p.title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-fg-muted">{p.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
