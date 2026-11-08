import { spaceDot, type SpaceColor } from "@/components/ui/letter-chip";
import { cn } from "@/lib/cn";
import Link from "next/link";
import type { ReactNode } from "react";

/** Folder-style card ("Client outreach · 1 videos" in the reference). */
export function SpaceCard({
  href,
  name,
  meta,
  color,
  icon,
  pending,
  className,
}: {
  href: string;
  name: string;
  /** Already-translated secondary line, e.g. "3 documents · Exam 12 Jan" (goal label + date). */
  meta: string;
  color: SpaceColor;
  /** Duotone folder icon slot (supplied later). */
  icon?: ReactNode;
  /** Optimistic item not yet confirmed by the server. */
  pending?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-disabled={pending || undefined}
      aria-busy={pending || undefined}
      className={cn(
        pending && "pointer-events-none animate-pulse opacity-60",
        "group flex min-h-[4.75rem] items-center justify-between gap-3 rounded-card border border-border/60 bg-surface/50 px-4 py-3 transition-colors hover:border-border hover:bg-surface",
        className,
      )}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span dir="auto" className="text-[0.9375rem] font-semibold wrap-anywhere text-fg-body group-hover:text-fg">
          {name}
        </span>
        <span className="flex items-center gap-1.5 text-xs wrap-anywhere text-fg-subtle">
          <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", spaceDot[color])} />
          {meta}
        </span>
      </span>
      {icon && <span className="shrink-0 text-fg-muted">{icon}</span>}
    </Link>
  );
}
