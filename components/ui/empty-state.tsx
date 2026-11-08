import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  /** Duotone icon slot (supplied later). */
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <span className="inline-flex size-12 items-center justify-center rounded-card bg-surface text-fg-muted">
          {icon}
        </span>
      )}
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-sm font-bold text-fg">{title}</p>
        {description && <p className="text-xs leading-relaxed text-fg-muted">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
