"use client";

import { Card } from "@/components/ui/card";
import { ChartContainer, ChartTooltipBox } from "@/components/ui/chart";
import type { ReactNode } from "react";
import { useId } from "react";
import { Area, AreaChart, Tooltip, XAxis } from "recharts";

export type ChartPoint = { day: string; value: number };

const dayLabel = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const fmtDay = (day: string) => dayLabel.format(new Date(`${day}T00:00:00Z`));

/**
 * A Home stat as a small area chart (shadcn-style): the headline number, a
 * one-line note, and the trend under it. One series, so no legend: the label
 * names it. Hover / tap shows the day and its value.
 */
export function StatChartCard({
  label,
  icon,
  headline,
  note,
  series,
  seriesName,
  range,
  step = false,
  empty,
}: {
  label: string;
  icon: ReactNode;
  headline: ReactNode;
  note?: ReactNode;
  /** No series (or a single day): the card shows just the headline and note. */
  series?: ChartPoint[];
  /** Tooltip name of the value ("Cards due"). */
  seriesName: string;
  /** "Next 14 days", "Last 30 days"… */
  range?: string;
  /** Running totals (documents): steps instead of a curve. */
  step?: boolean;
  /** Shown over a flat chart when every value is 0. */
  empty?: string;
}) {
  const gid = useId().replace(/:/g, "");
  const allZero = !series || series.every((p) => p.value === 0);
  return (
    <Card className="flex min-h-[9.5rem] min-w-0 flex-col gap-1 border-border/60 bg-surface/50 px-4 pt-3 pb-2">
      <div className="flex items-start justify-between gap-3">
        <span
          dir="auto"
          className="min-w-0 text-xs wrap-anywhere text-fg-subtle"
        >
          {label}
        </span>
        <span className="shrink-0 text-fg-muted">{icon}</span>
      </div>
      <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[0.9375rem] font-semibold wrap-anywhere text-fg-body">
          {headline}
        </span>
        {note && (
          <span className="text-xs wrap-anywhere text-fg-subtle">{note}</span>
        )}
      </p>
      {series && series.length > 1 && (
        <div className="relative mt-auto">
          <ChartContainer className="h-16">
            <AreaChart
              data={series}
              margin={{ top: 6, right: 2, bottom: 0, left: 2 }}
              accessibilityLayer
            >
              <defs>
                <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-chart-1)"
                    stopOpacity={0.22}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-chart-1)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" hide />
              <Tooltip
                cursor={{
                  stroke: "var(--color-border-strong)",
                  strokeWidth: 1,
                }}
                content={({ active, payload }) => {
                  const p = active
                    ? (payload?.[0]?.payload as ChartPoint | undefined)
                    : undefined;
                  return p ? (
                    <ChartTooltipBox
                      label={fmtDay(p.day)}
                      name={seriesName}
                      value={String(p.value)}
                    />
                  ) : null;
                }}
              />
              <Area
                dataKey="value"
                type={step ? "stepAfter" : "monotone"}
                stroke="var(--color-chart-1)"
                strokeWidth={2}
                fill={`url(#fill-${gid})`}
                activeDot={{
                  r: 4,
                  strokeWidth: 2,
                  stroke: "var(--color-surface)",
                }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
          {allZero && empty && (
            <span className="pointer-events-none absolute inset-x-0 top-1 text-center text-[0.6875rem] text-fg-subtle">
              {empty}
            </span>
          )}
          {range && (
            <p className="mt-0.5 text-[0.6875rem] text-fg-subtle">{range}</p>
          )}
          {/* A table ignores the 1px sr-only box; the wrapper clips it. */}
          <div className="sr-only">
            <table>
              <caption>
                {label}, {range}
              </caption>
              <tbody>
                {series.map((p) => (
                  <tr key={p.day}>
                    <th scope="row">{fmtDay(p.day)}</th>
                    <td>{p.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
