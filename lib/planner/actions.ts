"use server";

import { getCurrentDbUser } from "@/lib/auth/current-user";
import { hasProAccess } from "@/lib/billing/access";
import { dayToDateColumn, isValidDay } from "@/lib/dates";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseStoredDay } from "./service";
import type { SetTaskDoneResult } from "./types";

const input = z.object({
  spaceId: z.string().min(1).max(64),
  day: z.string().refine(isValidDay),
  taskId: z.string().min(1).max(120),
  done: z.boolean(),
});

/** Tick / untick one plan task. Optimistic in the UI; the server is the source of truth. */
export async function setTaskDone(raw: z.input<typeof input>): Promise<SetTaskDoneResult> {
  const user = await getCurrentDbUser();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "That task doesn't exist." };
  if (!(await hasProAccess(user.id))) return { ok: false, error: "The goal planner is a Pro feature." };
  const { spaceId, day, taskId, done } = parsed.data;

  const ok = await db.$transaction(async (tx) => {
    const row = await tx.planDay.findFirst({
      where: { userId: user.id, spaceId, date: dayToDateColumn(day) },
      select: { id: true, tasks: true },
    });
    if (!row) return false;
    const stored = parseStoredDay(row.tasks);
    if (!stored.tasks.some((t) => t.id === taskId)) return false;
    const tasks = stored.tasks.map((t) => (t.id === taskId ? { ...t, done } : t));
    await tx.planDay.update({
      where: { id: row.id },
      data: { tasks: { ...stored, tasks }, done: tasks.length > 0 && tasks.every((t) => t.done) },
    });
    return true;
  });
  if (!ok) return { ok: false, error: "That task doesn't exist any more. Refresh the page." };

  revalidatePath("/", "layout");
  return { ok: true };
}
