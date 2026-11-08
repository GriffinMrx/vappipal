"use client";

import { VappiPal, type PalKick, type PalMood } from "@/components/pal/vappi-pal";
import { useEffect, useRef } from "react";

/**
 * The little pal that rides along the text while Vappi writes or edits. It
 * glides after each new word on a soft spring (never jumps), leans into the
 * direction it moves, and plays the reactions the editor sends it.
 */
export function CaretPal({
  target,
  mood,
  kick,
}: {
  /** Position in the document box, or null when Vappi isn't typing. */
  target: { x: number; y: number } | null;
  mood: PalMood;
  kick: PalKick;
}) {
  const el = useRef<HTMLSpanElement>(null);
  const goal = useRef(target);
  useEffect(() => {
    goal.current = target;
  }, [target]);

  useEffect(() => {
    const p = { x: 0, y: 0, vx: 0, vy: 0, placed: false };
    let last = performance.now();
    let frame = 0;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const tick = (now: number) => {
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;
      const g = goal.current;
      const node = el.current;
      if (g && node) {
        // Right after the last letter, on the same line (nothing is written there yet).
        const gx = g.x + 8;
        const gy = g.y - 3;
        // A new line or block: hop straight there instead of sweeping across the words.
        if (!p.placed || reduced || Math.hypot(gx - p.x, gy - p.y) > 80) {
          Object.assign(p, { x: gx, y: gy, vx: 0, vy: 0, placed: true });
        } else {
          // Stiff, nearly critically damped spring: keeps up word by word, still glides.
          const k = 900;
          const c = 2 * Math.sqrt(k) * 0.85;
          p.vx += (k * (gx - p.x) - c * p.vx) * dt;
          p.vy += (k * (gy - p.y) - c * p.vy) * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
        // Big jumps (a new line far away) are covered quickly but still glide.
        const lean = Math.max(-14, Math.min(14, p.vx * 0.04));
        node.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) rotate(${lean.toFixed(1)}deg)`;
      } else if (!g) p.placed = false;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!target) return null;
  return (
    <span aria-hidden ref={el} className="pointer-events-none absolute top-0 left-0 z-10 will-change-transform">
      <span className="absolute inset-0 -z-10 rounded-full bg-accent-bottom/60 blur-md" />
      <VappiPal mood={mood} size={30} label={false} kick={kick} />
    </span>
  );
}
