import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/**
 * Infinite Moving Cards, adapted from Aceternity UI (ui.aceternity.com/components/infinite-moving-cards).
 * Pure CSS: the list is rendered twice and slides left forever, pausing on
 * hover. Reduced motion: it stands still (globals.css).
 */
export function InfiniteMovingCards({
  items,
  speed = "slow",
  className,
}: {
  items: { key: string; content: ReactNode }[];
  speed?: "fast" | "normal" | "slow";
  className?: string;
}) {
  const duration = speed === "fast" ? "20s" : speed === "normal" ? "40s" : "70s";
  const row = (copy: number) =>
    items.map((item) => (
      <li key={`${copy}-${item.key}`} aria-hidden={copy === 1 || undefined} className="shrink-0">
        {item.content}
      </li>
    ));

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_12%,white_88%,transparent)]",
        className,
      )}
    >
      <ul
        className="animate-marquee flex w-max shrink-0 gap-4 py-2 hover:[animation-play-state:paused]"
        style={{ ["--marquee-duration" as string]: duration }}
      >
        {row(0)}
        {row(1)}
      </ul>
    </div>
  );
}
