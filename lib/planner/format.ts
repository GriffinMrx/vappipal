import type { PlanTask } from "./types";

// Plain helpers (no "use client") so server and client components can both call them.

export function taskLabel(t: PlanTask) {
  if (t.kind === "read") return "Read the summary";
  if (t.kind === "cards") return `Review ${t.count} flashcard${t.count === 1 ? "" : "s"}`;
  return "Take a quiz";
}
