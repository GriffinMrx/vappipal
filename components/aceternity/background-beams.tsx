"use client";

import { cn } from "@/lib/cn";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { motion } from "motion/react";
import { memo } from "react";

/**
 * Background Beams, adapted from Aceternity UI (ui.aceternity.com/components/background-beams).
 * Curved lines with a light that runs along each one. The curves follow the
 * original's pattern; timings come from the index (no randomness, so server and
 * client render the same). Reduced motion: the faint lines only.
 */
const BEAMS = 24;

const path = (i: number) => {
  const x = i * 7;
  const y = i * 8;
  return `M${-380 + x} ${-189 - y}C${-380 + x} ${-189 - y} ${-312 + x} ${216 - y} ${152 + x} ${343 - y}C${616 + x} ${470 - y} ${684 + x} ${875 - y} ${684 + x} ${875 - y}`;
};

const PATHS = Array.from({ length: BEAMS }, (_, i) => path(i));
// Deterministic "random" in [0, 1).
const noise = (i: number) => {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

export const BackgroundBeams = memo(function BackgroundBeams({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 flex items-center justify-center", className)}>
      <svg className="absolute inset-0 h-full w-full" width="100%" height="100%" viewBox="0 0 696 316" fill="none" preserveAspectRatio="xMidYMid slice">
        <path d={PATHS.join("")} stroke="url(#vappi-beams-base)" strokeOpacity="0.05" strokeWidth="0.5" />
        {!reduce &&
          PATHS.map((d, i) => (
            <motion.path key={i} d={d} stroke={`url(#vappi-beam-${i})`} strokeOpacity="0.45" strokeWidth="0.5" />
          ))}
        <defs>
          {!reduce &&
            PATHS.map((_, i) => (
              <motion.linearGradient
                key={i}
                id={`vappi-beam-${i}`}
                initial={{ x1: "0%", x2: "0%", y1: "0%", y2: "0%" }}
                animate={{ x1: ["0%", "100%"], x2: ["0%", "95%"], y1: ["0%", "100%"], y2: ["0%", `${93 + noise(i) * 8}%`] }}
                transition={{ duration: 10 + noise(i + 99) * 10, ease: "easeInOut", repeat: Infinity, delay: noise(i + 7) * 10 }}
              >
                <stop stopColor="var(--color-space-violet)" stopOpacity="0" />
                <stop stopColor="var(--color-space-violet)" />
                <stop offset="32.5%" stopColor="var(--color-accent-fg)" />
                <stop offset="100%" stopColor="var(--color-space-blue)" stopOpacity="0" />
              </motion.linearGradient>
            ))}
          <radialGradient id="vappi-beams-base" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(352 34) rotate(90) scale(555 1560.62)">
            <stop offset="0.0666667" stopColor="var(--color-fg-subtle)" />
            <stop offset="0.243243" stopColor="var(--color-fg-subtle)" />
            <stop offset="0.43594" stopColor="var(--color-fg)" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
});
