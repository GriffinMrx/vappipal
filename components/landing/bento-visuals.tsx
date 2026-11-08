import { Icon, type IconName } from "@/components/icons/icon";
import { VappiPal } from "@/components/pal/vappi-pal";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/*
 * Visuals for the Features bento, drawn after the Aceternity reference
 * (icon tiles with wires, a curve with a cursor, a row of AI orbs, a board with
 * cursors, a profile with a wave). Decorative: hidden from screen readers.
 */

/** lucide MousePointer2, filled — usable inside an <svg>. */
const CURSOR_PATH =
  "M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z";

function Cursor({ label, className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute flex flex-col items-start gap-1 transition-[translate] duration-500 ease-out motion-reduce:translate-none! motion-reduce:transition-none",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" className="text-space-blue drop-shadow-[0_0_6px_rgb(79_140_255/0.5)]">
        <path d={CURSOR_PATH} fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      {label && <span className="ms-3 text-eyebrow whitespace-nowrap text-fg-subtle">{label}</span>}
    </span>
  );
}

/* ── Upload anything: glass tiles with wires ─────────────────────────────── */

type Tile = { icon?: IconName; label?: string; color: string };

// 11 per row so the rows run past the card edges and fade out (centre = index 5).
const ROW_A: Tile[] = [
  { icon: "note", color: "text-space-violet" },
  { icon: "file-pdf", color: "text-space-red" },
  { icon: "file-image", color: "text-space-green" },
  { icon: "note", color: "text-space-teal" },
  { icon: "file-word", color: "text-space-blue" },
  { icon: "file-pdf", color: "text-space-red" },
  { label: "PPTX", color: "text-space-orange" },
  { icon: "document", color: "text-fg-body" },
  { icon: "file-image", color: "text-space-pink" },
  { icon: "file-word", color: "text-space-blue" },
  { label: "PPTX", color: "text-space-orange" },
];
const ROW_B: Tile[] = [
  { icon: "document", color: "text-fg-body" },
  { icon: "file-image", color: "text-space-pink" },
  { label: "PPTX", color: "text-space-orange" },
  { icon: "file-word", color: "text-space-blue" },
  { icon: "document", color: "text-fg-body" },
  { icon: "file-image", color: "text-space-green" },
  { icon: "file-pdf", color: "text-space-red" },
  { icon: "note", color: "text-space-teal" },
  { icon: "file-word", color: "text-space-violet" },
  { icon: "file-pdf", color: "text-space-red" },
  { icon: "note", color: "text-space-teal" },
];
const ACTIVE = 5;

function GlassTile({ tile, active, children }: { tile: Tile; active?: boolean; children?: ReactNode }) {
  return (
    <div
      className={cn(
        "relative flex size-14 shrink-0 items-center justify-center rounded-xl border p-1 sm:size-16",
        active ? "border-bento-border-strong bg-white/6" : "border-bento-border bg-white/3",
      )}
    >
      <div
        className={cn(
          "flex size-full items-center justify-center rounded-lg border border-bento-border bg-linear-to-b from-white/8 to-white/1 shadow-bento",
          tile.color,
          !active && "opacity-75",
        )}
      >
        {tile.icon ? <Icon name={tile.icon} size={24} /> : <span className="text-xs font-bold">{tile.label}</span>}
      </div>
      {children}
    </div>
  );
}

/** A 96×40 elbow wire with a light running along it. */
function Wire({ d, className }: { d: string; className: string }) {
  return (
    <svg aria-hidden width="96" height="40" viewBox="0 0 96 40" fill="none" className={cn("pointer-events-none absolute", className)}>
      <path d={d} stroke="var(--color-bento-wire)" strokeWidth="1" />
      <path
        d={d}
        stroke="var(--color-space-blue)"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeDasharray="28 232"
        className="animate-wire"
      />
    </svg>
  );
}

export function UploadTiles() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-hidden mask-[linear-gradient(to_right,transparent,white_18%,white_82%,transparent)]"
    >
      <div className="flex gap-4 pt-10">
        {ROW_A.map((t, i) => (
          <GlassTile key={i} tile={t} active={i === ACTIVE}>
            {i === ACTIVE && <Wire d="M0 0.5H84Q95.5 0.5 95.5 12V40" className="right-1/2 bottom-full translate-x-[0.5px]" />}
          </GlassTile>
        ))}
      </div>
      <div className="flex translate-x-9 gap-4 pb-10 sm:translate-x-10">
        {ROW_B.map((t, i) => (
          <GlassTile key={i} tile={t} active={i === ACTIVE}>
            {i === ACTIVE && <Wire d="M0.5 0V28Q0.5 39.5 12 39.5H96" className="top-full left-1/2" />}
          </GlassTile>
        ))}
      </div>
    </div>
  );
}

/* ── Goal planner: a curve with a dot, a pill and a cursor ───────────────── */

export function GoalCurve() {
  return (
    <div aria-hidden className="absolute inset-0 flex items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_60%,rgb(255_255_255/0.05),transparent_60%)]" />
      <svg viewBox="0 0 300 220" className="h-full w-full" preserveAspectRatio="xMidYMid meet" fill="none">
        <defs>
          <linearGradient id="goal-curve" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="var(--color-space-blue)" stopOpacity="0" />
            <stop offset="0.35" stopColor="var(--color-space-blue)" stopOpacity="0.9" />
            <stop offset="1" stopColor="var(--color-fg-subtle)" stopOpacity="0.5" />
          </linearGradient>
          <linearGradient id="goal-guide" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--color-fg)" stopOpacity="0" />
            <stop offset="0.5" stopColor="var(--color-fg)" stopOpacity="0.18" />
            <stop offset="1" stopColor="var(--color-fg)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="160" y1="40" x2="160" y2="220" stroke="url(#goal-guide)" />
        <path d="M0 108C45 108 62 64 100 74C128 82 138 132 160 132C186 132 214 68 300 48" stroke="url(#goal-curve)" strokeWidth="1.5" />
        <g>
          <rect x="102" y="20" width="116" height="24" rx="12" fill="rgb(255 255 255 / 0.04)" stroke="var(--color-bento-border)" />
          <text x="160" y="36" textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--color-fg-muted)">
            Exam in 6 days
          </text>
        </g>
        <circle cx="160" cy="132" r="9" fill="var(--color-fg)" fillOpacity="0.08" />
        <circle cx="160" cy="132" r="4" fill="var(--color-fg)" />
        <g className="transform-[translate(170px,138px)_scale(0.8)] transition-transform duration-500 ease-out group-hover/bento:transform-[translate(178px,146px)_scale(0.8)] motion-reduce:transition-none">
          <path d={CURSOR_PATH} fill="var(--color-space-blue)" stroke="var(--color-space-blue)" strokeWidth="1.5" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
}

/* ── Learn: a row of glass orbs around the pal ───────────────────────────── */

function Orb({ size, icon, className, children }: { size: string; icon?: IconName; className?: string; children?: ReactNode }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-bento-border bg-linear-to-b from-white/7 to-white/1 text-fg-muted shadow-bento",
        size,
        className,
      )}
    >
      {icon ? <Icon name={icon} size={18} /> : children}
    </div>
  );
}

export function LearnOrbs() {
  return (
    <div aria-hidden className="absolute inset-0 flex items-center justify-center gap-2.5 overflow-hidden sm:gap-3">
      <Orb size="size-7" icon="document" className="opacity-30 [&_svg]:size-3" />
      <Orb size="size-11" icon="layer" className="opacity-70" />
      <div className="relative">
        <div className="absolute -inset-3 rounded-full bg-fg/4 blur-md" />
        <Orb size="size-20 p-1.5" className="relative">
          <div className="flex size-full items-center justify-center rounded-full border border-bento-border bg-bg">
            <VappiPal mood="idle" size={44} label={false} />
          </div>
        </Orb>
      </div>
      <Orb size="size-11" icon="exam" className="opacity-70" />
      <Orb size="size-7" icon="checklist" className="opacity-30 [&_svg]:size-3" />
    </div>
  );
}

/* ── Create: a board with chips and two cursors ──────────────────────────── */

function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("w-fit rounded-lg border border-bento-border bg-bento-fill p-1 shadow-bento", className)}>
      <div className="rounded-md border border-bento-border-strong bg-white/3 px-3 py-1.5 text-xs whitespace-nowrap text-fg-body">
        {children}
      </div>
    </div>
  );
}

export function CreateBoard() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 mask-[linear-gradient(to_bottom,white,transparent_95%)] bg-[linear-gradient(to_right,var(--color-bento-border)_1px,transparent_1px)] bg-size-[28px_100%] bg-position-[14px_0] opacity-60" />
      <div className="relative flex justify-center gap-3 pt-2 sm:gap-4">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="size-2.5 shrink-0 rounded-full border border-bento-border-strong bg-white/6" />
        ))}
      </div>
      <div className="relative mx-auto mt-8 flex w-fit flex-col gap-4">
        <div className="relative">
          <Chip className="ms-2">Notes</Chip>
          <Cursor label="You" className="top-1 right-6 sm:top-3 sm:-right-11 group-hover/bento:translate-x-2 group-hover/bento:translate-y-1" />
        </div>
        <Chip className="ms-10">Email to my manager</Chip>
        <div className="relative">
          <Chip>Outline</Chip>
          <Cursor label="Vappi" className="-bottom-9 -left-2 group-hover/bento:-translate-x-1 group-hover/bento:-translate-y-2" />
        </div>
      </div>
    </div>
  );
}

/* ── Ask: the pal's card, a stat and a wave ──────────────────────────────── */

export function AskProfile() {
  return (
    <div aria-hidden className="absolute inset-0 flex flex-col items-center justify-center">
      <div className="rounded-2xl border border-bento-border bg-bento-fill p-1.5 shadow-bento">
        <div className="flex size-16 items-center justify-center rounded-xl border border-bento-border bg-linear-to-b from-accent-top to-bg sm:size-18">
          <VappiPal mood="happy" size={44} label={false} />
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold text-fg-muted">Vappi</p>
      <p className="mt-1.5 flex items-center gap-2 text-xs text-fg-subtle">
        Cited pages
        <span className="size-1 rounded-full bg-fg-subtle" />
        <span className="font-semibold text-fg-muted">p. 12, 13</span>
      </p>
      <svg viewBox="0 0 240 60" className="mt-5 h-14 w-full max-w-60" fill="none" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ask-wave" x1="0" x2="1">
            <stop offset="0" stopColor="var(--color-fg)" stopOpacity="0.5" />
            <stop offset="0.6" stopColor="var(--color-fg)" stopOpacity="0.7" />
            <stop offset="1" stopColor="var(--color-fg)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M2 50C10 50 12 14 22 14C32 14 30 46 40 46C50 46 50 26 60 26C70 26 70 40 80 40C92 40 92 30 104 30C118 30 116 36 130 34C150 32 150 8 166 8C182 8 180 30 196 40C210 48 222 52 238 54"
          stroke="url(#ask-wave)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
