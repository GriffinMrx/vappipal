"use client";

import { cn } from "@/lib/cn";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useRef, useState, type ReactNode } from "react";

type Step = { title: string; description: string; content: ReactNode };

/**
 * Sticky Scroll Reveal, adapted from Aceternity UI (ui.aceternity.com/components/sticky-scroll-reveal).
 * Desktop: the steps scroll by on the left while a sticky card on the right
 * shows the step in view (driven by page scroll, not an inner scroll box).
 * Below lg: a plain stacked list, each step with its card.
 */
export function StickyScroll({ steps, className }: { steps: Step[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start center", "end center"] });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActive(Math.min(steps.length - 1, Math.max(0, Math.floor(v * steps.length))));
  });

  return (
    <div className={className}>
      {/* Desktop */}
      <div ref={ref} className="relative hidden grid-cols-2 gap-16 lg:grid">
        <ol>
          {steps.map((step, i) => (
            <li key={step.title} className="flex min-h-[55vh] flex-col justify-center">
              <motion.div animate={{ opacity: active === i ? 1 : 0.3 }} transition={{ duration: 0.25 }}>
                <span className="text-eyebrow font-semibold tracking-wider text-fg-subtle uppercase">Step {i + 1}</span>
                <h3 className="mt-2 text-2xl font-bold text-fg">{step.title}</h3>
                <p className="mt-3 max-w-md text-base leading-relaxed text-fg-muted">{step.description}</p>
              </motion.div>
            </li>
          ))}
        </ol>
        <div className="relative">
          <div className="sticky top-[calc(50vh-11rem)] h-[22rem] overflow-hidden rounded-card border border-border bg-surface">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                aria-hidden={active !== i}
                className="absolute inset-0"
                initial={false}
                animate={{ opacity: active === i ? 1 : 0, scale: active === i ? 1 : 0.98 }}
                transition={{ duration: 0.3 }}
              >
                {step.content}
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Phones and tablets */}
      <ol className="flex flex-col gap-10 lg:hidden">
        {steps.map((step, i) => (
          <li key={step.title} className="flex flex-col gap-4">
            <div>
              <span className="text-eyebrow font-semibold tracking-wider text-fg-subtle uppercase">Step {i + 1}</span>
              <h3 className="mt-2 text-xl font-bold text-fg">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{step.description}</p>
            </div>
            <div className={cn("relative h-72 overflow-hidden rounded-card border border-border bg-surface sm:h-80")}>{step.content}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
