"use client";

import { cn } from "@/lib/cn";
import { BookOpen, PenLine, Search, Sparkles, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

const ICONS: Record<"search" | "read" | "write" | "think", LucideIcon> = {
  search: Search,
  read: BookOpen,
  write: PenLine,
  think: Sparkles,
};

/**
 * Vappi's "AI is working" indicator (original implementation, after the
 * public description of a typing-indicator pattern): a shimmering label with
 * an icon. It shows exactly the state the server reported (no timed
 * rotation), so it never claims to search when it isn't. Reduced motion holds
 * it still.
 */
export function AiTypingIndicator({
  label,
  icon = "think",
  showElapsed,
  className,
}: {
  label: string;
  icon?: keyof typeof ICONS;
  showElapsed?: boolean;
  className?: string;
}) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!showElapsed) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [showElapsed]);

  const Icon = ICONS[icon];

  return (
    <div className={cn("inline-flex items-center gap-2 text-sm", className)}>
      <span role="status" className="sr-only">
        {label}
      </span>
      <Icon aria-hidden className="size-4 shrink-0 animate-pulse text-accent-fg motion-reduce:animate-none" />
      <span
        key={label}
        aria-hidden
        className="animate-ai-shimmer bg-[linear-gradient(110deg,var(--color-fg-muted)_35%,var(--color-fg)_50%,var(--color-fg-muted)_65%)] bg-size-[200%_100%] bg-clip-text font-semibold text-transparent motion-reduce:animate-none motion-reduce:bg-none motion-reduce:text-fg-muted"
      >
        {label}
      </span>
      {showElapsed && seconds > 0 && (
        <span aria-hidden className="text-xs tabular-nums text-fg-subtle">
          {seconds}s
        </span>
      )}
    </div>
  );
}

/** Three bouncing dots, for "still writing" moments. */
export function TypingDots({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex items-center gap-1 align-middle", className)}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-dot rounded-full bg-fg-muted motion-reduce:animate-none"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}
