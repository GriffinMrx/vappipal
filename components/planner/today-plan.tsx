"use client";

import type { TodayTask } from "@/lib/planner/types";
import Link from "next/link";
import { PlanTaskList } from "./plan-task-list";

/** Today's tasks across spaces (Planner + Home). */
export function TodayPlan({ tasks, limit, moreHref }: { tasks: TodayTask[]; limit?: number; moreHref?: string }) {
  const shown = limit ? tasks.slice(0, limit) : tasks;
  return (
    <div className="flex flex-col">
      <PlanTaskList tasks={shown} showSpace />
      {limit && tasks.length > limit && moreHref && (
        <Link href={moreHref} className="min-h-11 self-start pt-2 text-sm font-semibold text-fg-muted hover:text-fg">
          {tasks.length - limit} more in the planner
        </Link>
      )}
    </div>
  );
}
