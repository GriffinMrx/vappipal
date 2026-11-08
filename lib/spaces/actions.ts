"use server";

import { getCurrentDbUser } from "@/lib/auth/current-user";
import { dayInZone, dayToDateColumn, isValidDay } from "@/lib/dates";
import { db } from "@/lib/db";
import { rebuildPlanSafely } from "@/lib/planner/service";
import { deleteObject } from "@/lib/storage";
import { GOAL_LABEL_MAX } from "./goal";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { spaceColorValues, type CreateSpaceResult, type DeleteSpaceResult, type UpdateSpaceResult } from "./types";

const createSpaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the space a name.")
    .max(60, "Keep the name under 60 characters."),
  goalDate: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || isValidDay(v), "Pick a valid date."),
  goalLabel: z
    .string()
    .trim()
    .max(GOAL_LABEL_MAX, `Keep the goal under ${GOAL_LABEL_MAX} characters.`)
    .optional()
    .transform((v) => (v ? v : null)),
  color: z.enum(spaceColorValues),
});

export async function createSpace(input: {
  name: string;
  goalDate?: string;
  goalLabel?: string;
  color: string;
}): Promise<CreateSpaceResult> {
  // Re-check the user on the server; never trust the client (AGENTS.md §5).
  const user = await getCurrentDbUser();

  const parsed = createSpaceSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: NonNullable<Extract<CreateSpaceResult, { ok: false }>["fieldErrors"]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as "name" | "goalDate" | "goalLabel" | "color";
      fieldErrors[field] ??= issue.message;
    }
    return { ok: false, fieldErrors };
  }

  const { name, goalDate, goalLabel, color } = parsed.data;
  // "Today" is the user's day, not the server's.
  if (goalDate && goalDate < dayInZone(user.timeZone)) {
    return { ok: false, fieldErrors: { goalDate: "The goal date can't be in the past." } };
  }

  const space = await db.space.create({
    data: {
      userId: user.id,
      name,
      color,
      goalDate: goalDate ? dayToDateColumn(goalDate) : null,
      goalLabel,
    },
    select: { id: true, name: true, color: true },
  });

  revalidatePath("/", "layout");
  return { ok: true, space: { ...space, goalDate, goalLabel, documentCount: 0 } };
}

const updateSpaceSchema = createSpaceSchema.extend({ id: z.string().min(1).max(64) });

type FieldErrorMap = NonNullable<Extract<UpdateSpaceResult, { ok: false }>["fieldErrors"]>;

/** Rename / change the goal (date + label) or colour. Rebuilds the plan when the date changes. */
export async function updateSpace(input: {
  id: string;
  name: string;
  goalDate?: string;
  goalLabel?: string;
  color: string;
}): Promise<UpdateSpaceResult> {
  const user = await getCurrentDbUser();
  const parsed = updateSpaceSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: FieldErrorMap = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "name" || field === "goalDate" || field === "goalLabel" || field === "color") fieldErrors[field] ??= issue.message;
    }
    return { ok: false, fieldErrors, formError: fieldErrors.name || fieldErrors.goalDate || fieldErrors.goalLabel ? undefined : "Space not found." };
  }
  const { id, name, goalDate, goalLabel, color } = parsed.data;

  const current = await db.space.findFirst({ where: { id, userId: user.id }, select: { goalDate: true } });
  if (!current) return { ok: false, formError: "Space not found." };
  const currentDay = current.goalDate ? current.goalDate.toISOString().slice(0, 10) : null;
  // A new date can't be in the past (keeping an old one, or clearing it, is fine).
  if (goalDate && goalDate !== currentDay && goalDate < dayInZone(user.timeZone)) {
    return { ok: false, fieldErrors: { goalDate: "The goal date can't be in the past." } };
  }

  await db.space.updateMany({
    where: { id, userId: user.id },
    data: { name, color, goalLabel, goalDate: goalDate ? dayToDateColumn(goalDate) : null },
  });
  if (goalDate !== currentDay) await rebuildPlanSafely(user.id, id);

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Delete a space: rows cascade (documents, cards, chat, plan); stored files are removed after. */
export async function deleteSpace(input: { id: string }): Promise<DeleteSpaceResult> {
  const user = await getCurrentDbUser();
  const parsed = z.object({ id: z.string().min(1).max(64) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Space not found." };

  const space = await db.space.findFirst({
    where: { id: parsed.data.id, userId: user.id },
    select: { id: true, documents: { select: { fileKey: true } } },
  });
  if (!space) return { ok: false, error: "Space not found." };

  await db.space.delete({ where: { id: space.id } });
  // Rows are gone either way; a storage hiccup only leaves a private orphan.
  await Promise.allSettled(space.documents.map((d) => deleteObject(d.fileKey)));

  revalidatePath("/", "layout");
  return { ok: true };
}
