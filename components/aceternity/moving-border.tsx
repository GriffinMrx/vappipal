"use client";

import { cn } from "@/lib/cn";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { motion, useAnimationFrame, useMotionTemplate, useMotionValue, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";

/**
 * Moving Border, adapted from Aceternity UI (ui.aceternity.com/components/moving-border).
 * A glow travels round the edge of whatever it wraps (a button or a link).
 * Reduced motion: a still glow in one corner.
 */
export function MovingBorder({
  children,
  className,
  duration = 3500,
  rx = "28",
}: {
  children: ReactNode;
  className?: string;
  duration?: number;
  rx?: string;
}) {
  const reduce = useReducedMotion();
  const rectRef = useRef<SVGRectElement>(null);
  const progress = useMotionValue(0);

  useAnimationFrame((time) => {
    if (reduce) return;
    const length = rectRef.current?.getTotalLength();
    if (length) progress.set((time * (length / duration)) % length);
  });

  const x = useTransform(progress, (v) => rectRef.current?.getPointAtLength(v).x ?? 0);
  const y = useTransform(progress, (v) => rectRef.current?.getPointAtLength(v).y ?? 0);
  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`;

  return (
    <div className={cn("relative inline-flex overflow-hidden rounded-pill p-px", className)}>
      <div aria-hidden className="absolute inset-0">
        <svg preserveAspectRatio="none" className="absolute h-full w-full" width="100%" height="100%">
          <rect ref={rectRef} fill="none" width="100%" height="100%" rx={rx} ry={rx} />
        </svg>
        <motion.div style={{ position: "absolute", top: 0, left: 0, display: "inline-block", transform }}>
          <div className="h-16 w-16 bg-[radial-gradient(var(--color-space-violet)_40%,transparent_60%)] opacity-90" />
        </motion.div>
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
