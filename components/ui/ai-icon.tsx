import { cn } from "@/lib/cn";
import { Sparkle } from "lucide-react";

/**
 * Vappi's AI mark on buttons: two solid sparkles that twinkle (the big one
 * breathes and turns a little, the small one blinks). Faster while `busy`;
 * still for reduced motion. Decorative: the button's text names the action.
 */
export function AiIcon({ className, busy = false }: { className?: string; busy?: boolean }) {
  return (
    <span aria-hidden data-busy={busy || undefined} className={cn("ai-icon relative inline-flex size-4 shrink-0", className)}>
      <Sparkle className="ai-icon-big absolute inset-[6%] size-[88%] fill-current" strokeWidth={1.5} />
      <Sparkle className="ai-icon-small absolute -top-[22%] -right-[24%] size-[46%] fill-current" strokeWidth={2} />
    </span>
  );
}
