import "server-only";

import { db } from "@/lib/db";
import { rebuildPlanSafely } from "@/lib/planner/service";
import { NonRetriableError } from "inngest";
import { EVENTS, inngest, type StudyRegenerateData } from "./client";
import { PART_STEP, runPart } from "./study-material";

/**
 * Retry / regenerate one part (summary, flashcards or quiz) of a Ready
 * document, only when the user asks (AGENTS.md §7). Same code as the
 * processing job; one run per document+part at a time.
 */
export const regenerateStudyMaterial = inngest.createFunction(
  {
    id: "regenerate-study-material",
    triggers: [{ event: EVENTS.studyRegenerate }],
    retries: 2,
    concurrency: [{ key: "event.data.userId", limit: 2 }, { limit: 10 }],
    singleton: { key: 'event.data.documentId + "-" + event.data.part', mode: "skip" },
    onFailure: async ({ event }) => {
      const data = event.data.event.data as StudyRegenerateData;
      await db.documentStep.updateMany({
        where: { documentId: data.documentId, step: PART_STEP[data.part], status: "RUNNING" },
        data: { status: "FAILED", error: "Something went wrong. Try again." },
      });
    },
  },
  async ({ event, step, attempt, maxAttempts }) => {
    const data = event.data as StudyRegenerateData;
    if (!(data.part in PART_STEP)) throw new NonRetriableError("Unknown part");
    const finalAttempt = attempt + 1 >= (maxAttempts ?? 3);
    // A fresh seed so a regenerated quiz isn't identical to the last one.
    const result = await step.run(`study-${data.part}`, () =>
      runPart(data, data.part, { finalAttempt, seed: event.id ?? String(Date.now()) }),
    );
    // New flashcards / questions change the plan's counts and quizzes.
    if (data.part !== "summary") {
      await step.run("update-plan", async () => {
        const doc = await db.document.findFirst({
          where: { id: data.documentId, userId: data.userId },
          select: { spaceId: true },
        });
        if (doc) await rebuildPlanSafely(data.userId, doc.spaceId);
      });
    }
    return { part: data.part, result };
  },
);
