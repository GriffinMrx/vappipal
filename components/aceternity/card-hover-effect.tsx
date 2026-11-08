"use client";

import { cn } from "@/lib/cn";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";

/**
 * Card Hover Effect, adapted from Aceternity UI (ui.aceternity.com/components/card-hover-effect):
 * a soft highlight glides behind whichever card the pointer (or keyboard focus) is on.
 */
export function HoverEffect({
  items,
  className,
}: {
  items: { key: string; content: ReactNode; className?: string }[];
  className?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-3", className)}>
      {items.map((item, i) => (
        <div
          key={item.key}
          className="group relative flex p-2"
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered(i)}
          onBlur={() => setHovered(null)}
        >
          <AnimatePresence>
            {hovered === i && (
              <motion.span
                aria-hidden
                className="absolute inset-0 block rounded-[1.1rem] bg-surface-active/70"
                layoutId="pricing-hover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.15 } }}
                exit={{ opacity: 0, transition: { duration: 0.15, delay: 0.2 } }}
              />
            )}
          </AnimatePresence>
          <div className={cn("relative z-10 flex w-full min-w-0 flex-col", item.className)}>{item.content}</div>
        </div>
      ))}
    </div>
  );
}
