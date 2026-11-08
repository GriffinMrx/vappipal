/** Plan shapes shared by server and client (no server-only imports). */

export type PlanTaskKind = "read" | "cards" | "quiz";

export type PlanTask = {
  /** Deterministic: read:{documentId} · cards:{day} · quiz:{day} (done state survives rebuilds). */
  id: string;
  kind: PlanTaskKind;
  documentId?: string;
  title?: string;
  count?: number;
  done: boolean;
};

export type PlanDay = { day: string; tasks: PlanTask[]; review: boolean };

export type SpacePlanView = {
  spaceId: string;
  spaceName: string;
  color: string;
  goalDate: string | null;
  goalLabel: string | null;
  /** Whole days from today to the goal (0 = today). null without a date. */
  daysLeft: number | null;
  days: PlanDay[];
  doneTasks: number;
  totalTasks: number;
};

export type SetTaskDoneResult = { ok: true } | { ok: false; error: string };

export type TodayTask = PlanTask & { spaceId: string; spaceName: string; color: string; day: string };
