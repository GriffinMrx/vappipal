import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** "📁 Folders ............ See all →" */
export function SectionHeader({
  icon,
  title,
  seeAllHref,
  seeAllLabel,
}: {
  /** Duotone icon slot (supplied later). */
  icon?: ReactNode;
  title: string;
  seeAllHref?: string;
  seeAllLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="flex items-center gap-3 text-lg font-medium text-fg-body">
        {icon && <span className="text-fg-muted">{icon}</span>}
        {title}
      </h2>
      {seeAllHref && seeAllLabel && (
        <Link
          href={seeAllHref}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md text-sm font-semibold text-fg-body transition-colors hover:text-fg lg:min-h-0"
        >
          {seeAllLabel}
          <ArrowRight aria-hidden className="size-4 rtl:-scale-x-100" />
        </Link>
      )}
    </div>
  );
}
