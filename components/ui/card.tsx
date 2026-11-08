import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

export const cardClasses = "rounded-card border border-border bg-surface";

export const interactiveCardClasses =
  "rounded-card border border-border bg-surface transition-colors hover:border-border-strong hover:bg-surface-hover";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(cardClasses, className)} {...props} />;
}
