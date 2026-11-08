"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { spaceDot, type SpaceColor as UiColor } from "@/components/ui/letter-chip";
import { EditSpaceButton } from "@/components/spaces/space-header";
import { useSpaceView } from "@/components/spaces/spaces-provider";
import { cn } from "@/lib/cn";
import { daysBetween } from "@/lib/dates";
import type { SpaceColor } from "@/lib/generated/prisma/enums";
import { taskLabel } from "@/lib/planner/format";
import { goalCountdown } from "@/lib/spaces/goal";
import type { PlanDay, SpacePlanView } from "@/lib/planner/types";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { taskKey, usePlan } from "./plan-provider";
import { PlanTaskList } from "./plan-task-list";

const VISIBLE_DAYS = 14;
const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function dayLabel(day: string, today: string) {
  const d = daysBetween(today, day);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return weekday.format(new Date(`${day}T00:00:00Z`));
}


/** One Space's plan: goal countdown, progress, and the days until the goal. */
export function SpacePlanCard({ plan, today, showTitle = true }: { plan: SpacePlanView; today: string; showTitle?: boolean }) {
  const { overrides } = usePlan();
  const [showAll, setShowAll] = useState(false);
  const space = { id: plan.spaceId, name: plan.spaceName, goalDate: plan.goalDate, goalLabel: plan.goalLabel, color: plan.color as SpaceColor };
  const view = useSpaceView(space);
  if (!view) return null;

  // Progress with the optimistic ticks applied.
  let done = plan.doneTasks;
  for (const d of plan.days)
    for (const t of d.tasks) {
      const o = overrides[taskKey(plan.spaceId, d.day, t.id)];
      if (o !== undefined && o !== t.done) done += o ? 1 : -1;
    }
  const pct = plan.totalTasks ? Math.round((done / plan.totalTasks) * 100) : 0;
  const days = showAll ? plan.days : plan.days.slice(0, VISIBLE_DAYS);
  const dot = spaceDot[plan.color.toLowerCase() as UiColor];

  return (
    <Card className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {showTitle && (
            <Link href={`/spaces/${plan.spaceId}?tab=plan`} className="flex min-h-11 items-center gap-2 hover:underline lg:min-h-0">
              <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", dot)} />
              <span className="text-base font-bold text-fg wrap-anywhere">{view.name}</span>
            </Link>
          )}
          <p className="text-sm text-fg-muted">
            <span className="font-semibold text-fg-body">{goalCountdown(plan.daysLeft, view.goalLabel)}</span>
            {plan.goalDate && ` · ${weekday.format(new Date(`${plan.goalDate}T00:00:00Z`))}`}
          </p>
        </div>
        <EditSpaceButton space={space} label="Change date" variant="subtle" />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs text-fg-subtle">
          <span>Plan progress</span>
          <span className="tabular-nums">
            {done} / {plan.totalTasks} tasks
          </span>
        </div>
        <Progress value={pct} label={`${view.name} plan progress`} />
      </div>

      <ol className="flex flex-col gap-2">
        {days.map((d) => (
          <DayRow key={d.day} day={d} today={today} spaceId={plan.spaceId} />
        ))}
      </ol>

      {plan.days.length > VISIBLE_DAYS && (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="min-h-11 self-start text-sm font-semibold text-fg-muted hover:text-fg"
        >
          {showAll ? "Show fewer days" : `Show all ${plan.days.length} days`}
        </button>
      )}
    </Card>
  );
}

function DayRow({ day, today, spaceId }: { day: PlanDay; today: string; spaceId: string }) {
  const { overrides } = usePlan();
  const near = daysBetween(today, day.day) <= 1;
  const [open, setOpen] = useState(near);
  const tasks = day.tasks.map((t) => ({ ...t, spaceId, day: day.day }));
  const doneCount = day.tasks.filter((t) => overrides[taskKey(spaceId, day.day, t.id)] ?? t.done).length;
  const allDone = day.tasks.length > 0 && doneCount === day.tasks.length;
  const summary = day.tasks.length ? day.tasks.map(taskLabel).join(" · ") : "Rest day";

  return (
    <li className="rounded-control border border-border/70 bg-bg/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        disabled={day.tasks.length === 0}
        className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-start disabled:cursor-default"
      >
        <span className="w-24 shrink-0 text-sm font-semibold text-fg-body sm:w-28">{dayLabel(day.day, today)}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-fg-subtle">{summary}</span>
        {day.review && <Badge className="hidden sm:inline-flex">Review</Badge>}
        {day.tasks.length > 0 && (
          <span className={cn("shrink-0 text-xs tabular-nums", allDone ? "text-success" : "text-fg-subtle")}>
            {doneCount}/{day.tasks.length}
          </span>
        )}
        {day.tasks.length > 0 && (
          <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-fg-subtle transition-transform", open && "rotate-180")} />
        )}
      </button>
      {open && day.tasks.length > 0 && (
        <div className="border-t border-border/70 px-1 sm:px-2">
          <PlanTaskList tasks={tasks} />
        </div>
      )}
    </li>
  );
}
