"use client";

import { StatChartCard, type ChartPoint } from "@/components/home/stat-chart-card";
import { Icon } from "@/components/icons/icon";
import { useMergedSpaces } from "@/components/spaces/spaces-provider";
import { daysBetween } from "@/lib/dates";
import { goalName } from "@/lib/spaces/goal";
import type { SpaceView } from "@/lib/spaces/types";

// Own file (not space-views.tsx): the app layout imports space-views, and
// keeping Recharts out of it keeps the chart library off every other page.

/** Goal-card data per Space (Pro: the plan's tasks per day from today to the goal). */
export type GoalPlanChart = { series: ChartPoint[]; done: number; total: number };

/** Today row as 4 small area-chart cards (prompt 36). The goal headline updates optimistically with the spaces. */
export function HomeStats({
  spaces,
  today,
  cardsDue,
  charts,
  goalPlans,
  pro,
}: {
  spaces: SpaceView[];
  today: string;
  cardsDue: number;
  charts: {
    cardsDue: ChartPoint[];
    quiz: { series: ChartPoint[]; total: number; correctPct: number | null };
    documents: ChartPoint[];
  };
  goalPlans: Record<string, GoalPlanChart>;
  pro: boolean;
}) {
  const all = useMergedSpaces(spaces);
  const next = all
    .filter((s) => s.goalDate && s.goalDate >= today)
    .sort((a, b) => a.goalDate!.localeCompare(b.goalDate!))[0];
  // Days first (the key info); the space name sits in the label.
  let nextGoal = "No goal date yet";
  let nextGoalLabel = "Next goal";
  if (next?.goalDate) {
    const days = daysBetween(today, next.goalDate);
    nextGoal = days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
    nextGoalLabel = `${goalName(next.goalLabel)} · ${next.name}`;
  }
  const plan = next ? goalPlans[next.id] : undefined;
  const documents = charts.documents.at(-1)?.value ?? 0;
  const { quiz } = charts;
  return (
    <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
      <StatChartCard
        label="Cards due today"
        icon={<Icon name="layer" size={22} />}
        headline={cardsDue}
        series={charts.cardsDue}
        seriesName="Cards due"
        range="Next 14 days"
        empty="No cards due"
      />
      <StatChartCard
        label="Quiz answers"
        icon={<Icon name="exam" size={22} />}
        headline={quiz.total}
        note={quiz.correctPct !== null ? `${quiz.correctPct}% right` : undefined}
        series={quiz.series}
        seriesName="Answers"
        range="Last 30 days"
        empty="No quiz answers yet"
      />
      <StatChartCard
        label="Documents"
        icon={<Icon name="document" size={22} />}
        headline={documents}
        series={charts.documents}
        seriesName="Documents"
        range="Last 30 days"
        step
        empty="No documents yet"
      />
      <StatChartCard
        label={nextGoalLabel}
        icon={<Icon name="planner" size={22} />}
        headline={nextGoal}
        note={
          !next
            ? "Add one to a Space"
            : plan
              ? `${plan.done} of ${plan.total} tasks done`
              : !pro
                ? "Daily plan is a Pro feature"
                : undefined
        }
        series={plan?.series}
        seriesName="Tasks"
        range={plan ? "Tasks per day until the goal" : undefined}
      />
    </div>
  );
}
