"use client";

import { cn } from "@/lib/cn";
import { useEffect, useId, useRef, useState } from "react";

/**
 * Vappi pal: Vappi's AI character. A soft white blob with two pill eyes whose
 * expression and motion show what the AI is doing. Original SVG (no
 * third-party code).
 *
 * Motion: one requestAnimationFrame loop per animated pal writes transforms
 * straight to the SVG (no React renders per frame). Every mood is a set of
 * motion amounts (float, sway, bounce, scan…) that the loop blends toward, so a
 * mood change never snaps; hops are a spring impulse; the eyes follow their
 * target through a near-critically-damped spring, so they glide.
 * prefers-reduced-motion: no loop, the body stays still; blinks and
 * expressions still change.
 */

export type PalMood = "idle" | "greeting" | "thinking" | "searching" | "writing" | "happy" | "sad" | "sleeping";
/** A one-off reaction: a hop (excited), a wiggle (playful / curious) or a nod (a small dip). */
export type PalKick = { n: number; kind: "hop" | "wiggle" | "nod" };

const LABEL: Record<PalMood, string> = {
  idle: "Vappi",
  greeting: "Vappi says hi",
  thinking: "Vappi is thinking",
  searching: "Vappi is searching your files",
  writing: "Vappi is writing",
  happy: "Vappi is happy",
  sad: "Vappi is sad",
  sleeping: "Vappi is asleep",
};

/** Per-eye pose: vertical scale, tilt (deg) and nudge (SVG units). */
type EyePose = { sy: number; rot: number; dx: number; dy: number };
type Face = { left: EyePose; right: EyePose; look: [number, number]; arcs?: boolean };

const N: EyePose = { sy: 1, rot: 0, dx: 0, dy: 0 };
const FACES: Record<PalMood, Face> = {
  idle: { left: N, right: N, look: [0, 0] },
  greeting: { left: N, right: N, look: [0, 0], arcs: true },
  happy: { left: N, right: N, look: [0, -1], arcs: true },
  thinking: { left: { ...N, sy: 0.8 }, right: N, look: [5, -6] },
  searching: { left: { ...N, sy: 0.9 }, right: { ...N, sy: 0.9 }, look: [0, -1] },
  writing: { left: { ...N, sy: 0.62 }, right: { ...N, sy: 0.62 }, look: [-2, 5] },
  sad: { left: { sy: 0.85, rot: 24, dx: 1, dy: 3 }, right: { sy: 0.85, rot: -24, dx: -1, dy: 3 }, look: [0, 3] },
  sleeping: { left: { ...N, sy: 0.1 }, right: { ...N, sy: 0.1 }, look: [0, 4] },
};

/** Motion amounts per mood (SVG units / degrees). The loop eases between them. */
type Motion = { float: number; sway: number; bounce: number; breathe: number; sink: number; scan: number };
const MOTION: Record<PalMood, Motion> = {
  idle: { float: 2.2, sway: 0, bounce: 0, breathe: 0.012, sink: 0, scan: 0 },
  greeting: { float: 1.8, sway: 0, bounce: 0, breathe: 0.01, sink: 0, scan: 0 },
  happy: { float: 1.8, sway: 0, bounce: 0, breathe: 0.01, sink: 0, scan: 0 },
  thinking: { float: 1.4, sway: 3, bounce: 0, breathe: 0.008, sink: 0, scan: 0 },
  searching: { float: 1.2, sway: 0.8, bounce: 0, breathe: 0.008, sink: 0, scan: 6 },
  writing: { float: 0.6, sway: 0, bounce: 1.6, breathe: 0, sink: 0, scan: 0 },
  sad: { float: 0.7, sway: 0, bounce: 0, breathe: 0.006, sink: 4, scan: 0 },
  sleeping: { float: 0, sway: 0, bounce: 0, breathe: 0.025, sink: 1.5, scan: 0 },
};
const MOTION_KEYS = Object.keys(MOTION.idle) as (keyof Motion)[];

const BODY = "M50 8 C77 8 92 24 92 51 C92 78 76 92 50 92 C24 92 8 78 8 51 C8 24 23 8 50 8 Z";
const TAU = Math.PI * 2;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Body transform around its bottom centre (50, 92). */
function bodyTransform(y: number, rot: number, sx: number, sy: number) {
  return `translate(50 ${92 + y}) rotate(${rot}) scale(${sx} ${sy}) translate(-50 -92)`;
}

type Blink = "open" | "closed" | "opening";

export function VappiPal({
  mood = "idle",
  size = 28,
  animated = true,
  followPointer = false,
  kick,
  label,
  className,
}: {
  mood?: PalMood;
  size?: number;
  /** false = a still pal (e.g. past chat answers), expression only. */
  animated?: boolean;
  /** Eyes follow the mouse (big welcome pal, logo pal). */
  followPointer?: boolean;
  /** Bump `n` to play a reaction. */
  kick?: PalKick;
  /** Accessible name; omit when nearby text already says it (decorative). */
  label?: string | false;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const lookRef = useRef<SVGGElement>(null);
  const [blink, setBlink] = useState<Blink>("open");
  const face = FACES[mood];
  const canBlink = animated && mood !== "sleeping";

  // Live inputs for the loop (refs, so changing them never restarts it).
  const moodRef = useRef(mood);
  const pointerRef = useRef<[number, number] | null>(null);
  const glanceRef = useRef<[number, number]>([0, 0]);
  const hopRef = useRef(0);
  const kickRef = useRef<{ n: number; kind: PalKick["kind"] }>({ n: 0, kind: "hop" });

  useEffect(() => {
    if (kick) kickRef.current = { n: kick.n, kind: kick.kind };
  }, [kick]);

  // Hop impulse on greeting / happy (a second little hop for greeting).
  useEffect(() => {
    moodRef.current = mood;
    if (mood !== "greeting" && mood !== "happy") return;
    hopRef.current += 1;
    if (mood !== "greeting") return;
    const t = setTimeout(() => (hopRef.current += 1), 520);
    return () => clearTimeout(t);
  }, [mood]);

  // Blink: closes fast, opens a bit slower; sometimes a double blink.
  useEffect(() => {
    if (!canBlink) return;
    let t: ReturnType<typeof setTimeout>;
    const once = (then: () => void) => {
      setBlink("closed");
      t = setTimeout(() => {
        setBlink("opening");
        t = setTimeout(() => {
          setBlink("open");
          then();
        }, 150);
      }, 85);
    };
    const next = (delay: number) => {
      t = setTimeout(() => {
        const double = Math.random() < 1 / 6;
        once(() => (double ? (t = setTimeout(() => once(() => next(2800 + Math.random() * 2400)), 90)) : next(2800 + Math.random() * 2400)));
      }, delay);
    };
    next(1600 + Math.random() * 900);
    return () => clearTimeout(t);
  }, [canBlink]);

  // Idle: glance around now and then (target only; the loop glides to it).
  useEffect(() => {
    if (!animated || followPointer) return;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      t = setTimeout(() => {
        glanceRef.current = [(Math.random() - 0.5) * 10, (Math.random() - 0.5) * 6];
        t = setTimeout(() => {
          glanceRef.current = [0, 0];
          next();
        }, 1100);
      }, 3500 + Math.random() * 3500);
    };
    next();
    return () => clearTimeout(t);
  }, [animated, followPointer]);

  // Pointer target (no state: the loop reads it).
  useEffect(() => {
    if (!followPointer || !animated) return;
    const onMove = (e: PointerEvent) => {
      const r = svgRef.current?.getBoundingClientRect();
      if (!r) return;
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, d / 260);
      pointerRef.current = [(dx / d) * 7 * reach, (dy / d) * 5 * reach];
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      pointerRef.current = null;
    };
  }, [followPointer, animated]);

  // Still pal (not animated, or reduced motion): one pose per mood.
  useEffect(() => {
    if (animated && !prefersReducedMotion()) return;
    bodyRef.current?.setAttribute("transform", bodyTransform(MOTION[mood].sink, 0, 1, 1));
    const [lx, ly] = FACES[mood].look;
    lookRef.current?.setAttribute("transform", `translate(${lx} ${ly})`);
  }, [animated, mood]);

  // The motion loop (reads the mood from a ref, so it never restarts).
  useEffect(() => {
    const body = bodyRef.current;
    const look = lookRef.current;
    if (!body || !look || !animated || prefersReducedMotion()) return;

    const cur: Motion = { ...MOTION[moodRef.current] };
    const eye = { x: 0, y: 0, vx: 0, vy: 0 };
    const hop = { y: 0, v: 0, seen: hopRef.current };
    const tilt = { r: 0, v: 0 };
    let kickSeen = kickRef.current.n;
    let t = Math.random() * 10; // desync several pals
    let last = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;
      t += dt;
      const m = moodRef.current;
      const target = MOTION[m];

      // Blend motion amounts (~0.4 s time constant): no snapping between moods.
      const blend = 1 - Math.exp(-dt / 0.4);
      for (const k of MOTION_KEYS) cur[k] += (target[k] - cur[k]) * blend;

      // Hop: an upward impulse on a soft spring.
      if (hopRef.current !== hop.seen) {
        hop.seen = hopRef.current;
        hop.v -= 85;
      }
      // Reactions: hop (up), nod (a dip), wiggle (a springy tilt).
      if (kickRef.current.n !== kickSeen) {
        kickSeen = kickRef.current.n;
        const kind = kickRef.current.kind;
        if (kind === "hop") hop.v -= 95;
        else if (kind === "nod") hop.v += 45;
        else tilt.v += (Math.random() < 0.5 ? -1 : 1) * 260;
      }
      tilt.v += (-260 * tilt.r - 9 * tilt.v) * dt;
      tilt.r += tilt.v * dt;
      hop.v += (-170 * hop.y - 15 * hop.v) * dt;
      hop.y += hop.v * dt;

      const y =
        -cur.float * (0.5 - 0.5 * Math.cos((TAU * t) / 4)) +
        -cur.bounce * (0.5 - 0.5 * Math.cos(TAU * t * 1.1)) +
        cur.sink +
        hop.y;
      const rot = cur.sway * Math.sin((TAU * t) / 3.2) + tilt.r;
      // Squash and stretch from the hop speed, plus a slow breath.
      const stretch = Math.max(-0.06, Math.min(0.06, -hop.v * 0.0011)) - Math.max(0, hop.y) * 0.012;
      const breath = cur.breathe * Math.sin((TAU * t) / 3.8);
      const sy = 1 + stretch - breath;
      const sx = 1 - stretch * 0.8 + breath;
      body.setAttribute("transform", bodyTransform(y, rot, sx, sy));

      // Eyes: spring toward the target (mood look, pointer/glance, scan).
      const base = FACES[m].look;
      const free = m === "idle" || m === "greeting";
      const extra = free ? (pointerRef.current ?? glanceRef.current) : [0, 0];
      const tx = (free ? extra[0] : base[0]) + cur.scan * Math.sin((TAU * t) / 1.6);
      const ty = free ? extra[1] : base[1];
      const k = 140;
      const c = 2 * Math.sqrt(k) * 0.95;
      eye.vx += (k * (tx - eye.x) - c * eye.vx) * dt;
      eye.vy += (k * (ty - eye.y) - c * eye.vy) * dt;
      eye.x += eye.vx * dt;
      eye.y += eye.vy * dt;
      look.setAttribute("transform", `translate(${eye.x.toFixed(2)} ${eye.y.toFixed(2)})`);

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animated]);

  const eyeY = blink === "closed" ? 0.08 : 1;
  const eyeTransition =
    blink === "closed"
      ? "transform 85ms cubic-bezier(.5,0,.9,.6)"
      : blink === "opening"
        ? "transform 150ms cubic-bezier(.2,.8,.3,1)"
        : "transform 260ms cubic-bezier(.2,.8,.2,1)";
  const title = label === false ? undefined : (label ?? LABEL[mood]);
  const sad = mood === "sad";

  const eye = (cx: number, pose: EyePose) => (
    <g
      style={{
        transformBox: "fill-box",
        transformOrigin: "center",
        transform: `translate(${pose.dx}px, ${pose.dy}px) rotate(${pose.rot}deg) scaleY(${(face.arcs ? 1 : pose.sy) * eyeY})`,
        transition: eyeTransition,
      }}
    >
      {face.arcs ? (
        // Happy "^" eyes.
        <path d={`M${cx - 6} 52 Q${cx} 41 ${cx + 6} 52`} fill="none" stroke="#140a26" strokeWidth="5.5" strokeLinecap="round" />
      ) : (
        <>
          <rect x={cx - 4.75} y={37} width={9.5} height={21} rx={4.75} fill="#140a26" />
          <ellipse cx={cx + 1.3} cy={42.5} rx={1.6} ry={2.2} fill="#fff" opacity={0.9} />
        </>
      )}
    </g>
  );

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn("shrink-0 overflow-visible", className)}
    >
      <defs>
        {/* Porcelain white; a cool grey when sad. */}
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sad ? "#d9dbe3" : "#ffffff"} />
          <stop offset="0.55" stopColor={sad ? "#c4c7d1" : "#f1eff6"} />
          <stop offset="1" stopColor={sad ? "#a9adba" : "#d6d2e2"} />
        </linearGradient>
        {/* Soft shade along the bottom edge, for volume. */}
        <radialGradient id={`s${id}`} cx="0.5" cy="1.05" r="0.75">
          <stop offset="0.55" stopColor="#5b4f78" stopOpacity="0" />
          <stop offset="1" stopColor="#5b4f78" stopOpacity="0.22" />
        </radialGradient>
        {/* Small gloss at the top left. */}
        <radialGradient id={`h${id}`} cx="0.32" cy="0.22" r="0.3">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`g${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.3" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft ground shadow (stays on the ground while the body moves). */}
      <ellipse cx="50" cy="95" rx="30" ry="4.5" fill={`url(#g${id})`} />

      <g ref={bodyRef} style={{ willChange: "transform" }}>
        <path d={BODY} fill={`url(#b${id})`} />
        <path d={BODY} fill={`url(#s${id})`} />
        <path d={BODY} fill={`url(#h${id})`} />
        <path d={BODY} fill="none" stroke="#1a1030" strokeOpacity="0.1" strokeWidth="1.2" />

        {/* Eyes: shared look offset, written by the loop. */}
        <g ref={lookRef} style={{ willChange: "transform" }}>
          {eye(39, face.left)}
          {eye(61, face.right)}
        </g>

        {/* Thinking: a tiny thought dot */}
        {mood === "thinking" && (
          <circle cx="84" cy="16" r="4" fill="#fff" opacity="0.7" className="motion-safe:animate-pulse" />
        )}
      </g>

      {/* Sleeping: floating "z" */}
      {mood === "sleeping" && (
        <text
          x="74"
          y="22"
          fontSize="18"
          fontWeight="700"
          fill="currentColor"
          className="text-fg-muted motion-safe:animate-pal-z"
          style={{ transformBox: "fill-box" }}
        >
          z
        </text>
      )}
    </svg>
  );
}
