"use client";

import { cn } from "@/lib/cn";
import { taskLabel } from "@/lib/planner/format";
import type { PlanTask } from "@/lib/planner/types";
import { BookOpen, Check, Layers, ListChecks } from "lucide-react";
import Link from "next/link";
import { taskKey, usePlan } from "./plan-provider";

export type TaskRowData = PlanTask & { spaceId: string; day: string; spaceName?: string };

const ICON = { read: BookOpen, cards: Layers, quiz: ListChecks } as const;


function taskHref(t: TaskRowData) {
  const base = `/spaces/${t.spaceId}`;
  if (t.kind === "read") return `${base}?tab=summary${t.documentId ? `&doc=${t.documentId}` : ""}`;
  return `${base}?tab=${t.kind === "cards" ? "flashcards" : "quiz"}`;
}

/** Done state with the page's optimistic ticks applied. */
function useTaskDone(t: TaskRowData) {
  const { overrides } = usePlan();
  return overrides[taskKey(t.spaceId, t.day, t.id)] ?? t.done;
}

/** Checkbox rows (44px) with a link to where the task is done. */
export function PlanTaskList({ tasks, showSpace }: { tasks: TaskRowData[]; showSpace?: boolean }) {
  return (
    <ul className="flex flex-col divide-y divide-border/70">
      {tasks.map((t) => (
        <TaskRow key={`${t.spaceId}|${t.day}|${t.id}`} task={t} showSpace={showSpace} />
      ))}
    </ul>
  );
}

function TaskRow({ task, showSpace }: { task: TaskRowData; showSpace?: boolean }) {
  const { toggle } = usePlan();
  const done = useTaskDone(task);
  const Icon = ICON[task.kind];
  const label = taskLabel(task);
  const detail = [showSpace ? task.spaceName : null, task.kind === "read" ? task.title : null].filter(Boolean).join(" · ");
  return (
    <li className="flex items-center gap-3 py-1.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${label}${detail ? `, ${detail}` : ""}`}
        onClick={() => toggle({ spaceId: task.spaceId, day: task.day, taskId: task.id, done: !done })}
        className="group inline-flex size-11 shrink-0 items-center justify-center rounded-control"
      >
        <span
          className={cn(
            "inline-flex size-5 items-center justify-center rounded-md border transition-colors",
            done ? "border-success bg-success text-bg" : "border-border-strong group-hover:border-fg-subtle",
          )}
        >
          {done && <Check aria-hidden className="size-3.5" strokeWidth={3} />}
        </span>
      </button>
      <Link
        href={taskHref(task)}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-control pe-2 hover:text-fg"
      >
        <Icon aria-hidden className="size-4 shrink-0 text-fg-subtle" />
        <span className="flex min-w-0 flex-col">
          <span className={cn("text-sm font-semibold text-fg-body", done && "text-fg-subtle line-through")}>{label}</span>
          {detail && <span className="text-xs text-fg-subtle wrap-anywhere">{detail}</span>}
        </span>
      </Link>
    </li>
  );
}
