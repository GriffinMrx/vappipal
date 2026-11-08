import { cn } from "@/lib/cn";

export function Progress({
  value,
  label,
  className,
}: {
  /** 0–100. Omit for an indeterminate bar. */
  value?: number;
  label: string;
  className?: string;
}) {
  const clamped = value === undefined ? undefined : Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn("h-1.5 w-full overflow-hidden rounded-pill bg-surface-active", className)}
    >
      <div
        className={cn(
          "h-full rounded-pill bg-fg-body transition-[width] duration-300",
          clamped === undefined && "w-1/3 animate-pulse",
        )}
        style={clamped === undefined ? undefined : { width: `${clamped}%` }}
      />
    </div>
  );
}
