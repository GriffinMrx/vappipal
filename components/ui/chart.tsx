"use client";

import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

/**
 * Chart frame in the spirit of shadcn/ui charts (Recharts inside a sized,
 * responsive box), styled with our tokens. Recharts' own focus outline and
 * cursor are toned down so the chart stays quiet on the dark surface.
 */
export function ChartContainer({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "w-full min-w-0 text-xs [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none [&_.recharts-sector]:outline-none",
        className,
      )}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        {children as never}
      </ResponsiveContainer>
    </div>
  );
}

/** shadcn-style tooltip box: the label on top, then the value with its series swatch. */
export function ChartTooltipBox({ label, value, name }: { label: string; value: string; name: string }) {
  return (
    <div className="min-w-32 rounded-control border border-border-strong bg-surface-active px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-semibold text-fg">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-fg-muted">
        <span aria-hidden className="size-2 shrink-0 rounded-[2px] bg-chart-1" />
        <span className="flex-1">{name}</span>
        <span className="font-semibold text-fg tabular-nums">{value}</span>
      </p>
    </div>
  );
}
