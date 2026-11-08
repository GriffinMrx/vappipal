import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/**
 * Bento Grid, adapted from Aceternity UI (ui.aceternity.com/components/bento-grid
 * and the "How to create a bento grid" blog) to Vappi's tokens. 1 column on
 * phones, 2 on tablets, 3 on desktop; items set their own spans.
 */
export function BentoGrid({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "mx-auto grid w-full max-w-6xl grid-flow-row-dense grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The reference card shell: faint white edge, translucent fill, soft inset glow. */
export const bentoCardClasses =
  "rounded-xl border border-bento-border bg-bento-fill shadow-bento transition-colors duration-200 hover:border-bento-border-strong";

export function BentoGridItem({
  className,
  title,
  description,
  visual,
  textPosition = "bottom",
}: {
  className?: string;
  title: ReactNode;
  description: ReactNode;
  visual: ReactNode;
  /** The wide reference card has its text on top; the small ones at the bottom. */
  textPosition?: "top" | "bottom";
}) {
  const text = (
    <div className="relative z-10 min-w-0">
      <h3 className="py-2 text-lg font-semibold text-fg">{title}</h3>
      <p className="max-w-sm text-sm text-fg-muted">{description}</p>
    </div>
  );
  return (
    <article
      className={cn(
        "group/bento relative flex min-w-0 flex-col overflow-hidden p-6 sm:p-8",
        bentoCardClasses,
        className,
      )}
    >
      {textPosition === "top" && text}
      <div className={cn("relative min-h-56 flex-1 sm:min-h-64", textPosition === "top" ? "mt-4" : "mb-4")}>{visual}</div>
      {textPosition === "bottom" && text}
    </article>
  );
}
