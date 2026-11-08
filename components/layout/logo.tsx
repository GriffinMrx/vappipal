import { cn } from "@/lib/cn";
import { logoAspect, logoPath, logoViewBox } from "./logo-data";

/**
 * Vappi logo from assets/logo.svg (regenerate with `npm run logo`).
 * Single colour via `currentColor` (defaults to the `fg` token).
 */
export function Logo({ className, height = 36 }: { className?: string; height?: number }) {
  return (
    <svg
      viewBox={logoViewBox}
      height={height}
      width={Math.round(height * logoAspect)}
      role="img"
      aria-label="Vappi"
      className={cn("shrink-0 text-fg", className)}
    >
      <path d={logoPath} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
