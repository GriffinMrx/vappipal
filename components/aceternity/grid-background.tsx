import { cn } from "@/lib/cn";

/**
 * Grid background, adapted from Aceternity UI (ui.aceternity.com/components/grid-and-dot-backgrounds):
 * thin token-coloured grid lines that fade out from the centre.
 */
export function GridBackground({ className, variant = "grid" }: { className?: string; variant?: "grid" | "dot" }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_15%,transparent_70%)]",
        variant === "grid"
          ? "[background-image:linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] [background-size:44px_44px]"
          : "[background-image:radial-gradient(var(--color-border-strong)_1px,transparent_1px)] [background-size:22px_22px]",
        className,
      )}
    />
  );
}
