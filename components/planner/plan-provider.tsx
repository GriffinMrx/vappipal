"use client";

import { useToast } from "@/components/ui/toast";
import { setTaskDone } from "@/lib/planner/actions";
import { createContext, useCallback, useContext, useMemo, useOptimistic, useTransition, type ReactNode } from "react";

type Key = string; // `${spaceId}|${day}|${taskId}`
type Ctx = { overrides: Record<Key, boolean>; toggle: (t: { spaceId: string; day: string; taskId: string; done: boolean }) => void };

const PlanContext = createContext<Ctx | null>(null);

export const taskKey = (spaceId: string, day: string, taskId: string) => `${spaceId}|${day}|${taskId}`;

/**
 * Optimistic ticking for plan tasks (AGENTS.md §7). Every list on the page
 * shares it, so a task ticked in "Today" is ticked in its space card too.
 * On failure it rolls back and shows an error toast.
 */
export function PlanProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [overrides, setOverride] = useOptimistic<Record<Key, boolean>, { key: Key; done: boolean }>(
    {},
    (state, { key, done }) => ({ ...state, [key]: done }),
  );

  const toggle = useCallback(
    ({ spaceId, day, taskId, done }: { spaceId: string; day: string; taskId: string; done: boolean }) => {
      startTransition(async () => {
        setOverride({ key: taskKey(spaceId, day, taskId), done });
        try {
          const res = await setTaskDone({ spaceId, day, taskId, done });
          if (!res.ok) toast({ tone: "error", title: "Task not updated", description: res.error });
        } catch {
          toast({ tone: "error", title: "Task not updated", description: "Check your connection and try again." });
        }
      });
    },
    [setOverride, toast],
  );

  const value = useMemo(() => ({ overrides, toggle }), [overrides, toggle]);
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used inside <PlanProvider>");
  return ctx;
}
