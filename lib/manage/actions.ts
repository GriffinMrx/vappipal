"use server";

import { getCurrentDbUser } from "@/lib/auth/current-user";
import { hasProAccess } from "@/lib/billing/access";
import { deleteCreation, duplicateCreation, renameCreation, setCreationLook } from "@/lib/creations/actions";
import { db } from "@/lib/db";
import { deleteDocument, regenerateStudyMaterial, retryDocument } from "@/lib/documents/actions";
import { rebuildPlanSafely } from "@/lib/planner/service";
import { updateSpace } from "@/lib/spaces/actions";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MANAGE_OPS_MAX, manageOpSchema, type ApplyManageResult, type ManageOp, type ManageResult } from "./types";

const input = z.object({ spaceId: z.string().min(1).max(64), ops: z.array(z.unknown()).min(1).max(MANAGE_OPS_MAX) });

/**
 * "Do it" on Vappi's plan card. Runs each confirmed operation in order and
 * reports each one. Everything is checked again here: signed in, Pro, the
 * Space is the user's, and every id belongs to this user AND this Space —
 * a tampered plan can do nothing the user couldn't do by hand.
 */
export async function applyManagePlan(raw: { spaceId: string; ops: unknown[] }): Promise<ApplyManageResult> {
  const user = await getCurrentDbUser();
  if (!(await hasProAccess(user.id))) return { ok: false, error: "Vappi's AI is a Pro feature." };
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Nothing to do." };
  const { spaceId } = parsed.data;
  const space = await db.space.findFirst({ where: { id: spaceId, userId: user.id }, select: { id: true } });
  if (!space) return { ok: false, error: "Space not found." };

  const results: ManageResult[] = [];
  for (const o of parsed.data.ops) {
    const op = manageOpSchema.safeParse(o);
    if (!op.success) {
      results.push({ ok: false, error: "Not a valid change." });
      continue;
    }
    try {
      results.push(await run(user.id, spaceId, op.data));
    } catch {
      results.push({ ok: false, error: "Something went wrong." });
    }
  }
  revalidatePath("/", "layout");
  return { ok: true, results };
}

const fail = (error: string): ManageResult => ({ ok: false, error });
const done: ManageResult = { ok: true };

async function run(userId: string, spaceId: string, op: ManageOp): Promise<ManageResult> {
  const inSpace = { userId, spaceId };
  const fileOk = async (fileId: string) =>
    db.document.findFirst({ where: { id: fileId, ...inSpace }, select: { id: true, pageCount: true } });
  const creationOk = async (creationId: string) => db.creation.findFirst({ where: { id: creationId, ...inSpace }, select: { id: true } });

  switch (op.op) {
    case "space_rename":
    case "space_color":
    case "space_goal": {
      const s = await db.space.findFirst({ where: { id: spaceId, userId }, select: { name: true, color: true, goalDate: true, goalLabel: true } });
      if (!s) return fail("Space not found.");
      const current = { name: s.name, color: s.color as string, goalDate: s.goalDate?.toISOString().slice(0, 10), goalLabel: s.goalLabel ?? undefined };
      const next =
        op.op === "space_rename"
          ? { ...current, name: op.name }
          : op.op === "space_color"
            ? { ...current, color: op.color }
            : { ...current, goalDate: op.date ?? undefined, goalLabel: op.date ? (op.label ?? undefined) : undefined };
      const r = await updateSpace({ id: spaceId, ...next });
      return r.ok ? done : fail(r.fieldErrors?.goalDate ?? r.fieldErrors?.name ?? r.formError ?? "Couldn't change the Space.");
    }
    case "file_rename": {
      if (!(await fileOk(op.fileId))) return fail("File not found.");
      await db.document.updateMany({ where: { id: op.fileId, ...inSpace }, data: { title: op.title } });
      return done;
    }
    case "file_delete": {
      if (!(await fileOk(op.fileId))) return fail("File not found.");
      const r = await deleteDocument({ documentId: op.fileId });
      return r.ok ? done : fail(r.error);
    }
    case "file_retry": {
      if (!(await fileOk(op.fileId))) return fail("File not found.");
      const r = await retryDocument({ documentId: op.fileId });
      return r.ok ? done : fail(r.error);
    }
    case "file_regenerate": {
      if (!(await fileOk(op.fileId))) return fail("File not found.");
      const r = await regenerateStudyMaterial({ documentId: op.fileId, part: op.part });
      return r.ok ? done : fail(r.error);
    }
    case "summary_edit": {
      if (!(await fileOk(op.fileId))) return fail("File not found.");
      const data = { ...(op.short ? { short: op.short } : {}), ...(op.long ? { long: op.long } : {}), ...(op.keyTerms ? { keyTerms: op.keyTerms } : {}) };
      if (Object.keys(data).length === 0) return fail("Nothing to change.");
      const r = await db.summary.updateMany({ where: { documentId: op.fileId }, data });
      return r.count ? done : fail("This file has no summary yet.");
    }
    case "card_add": {
      const f = await fileOk(op.fileId);
      if (!f) return fail("File not found.");
      if (f.pageCount && op.page > f.pageCount) return fail("That page isn't in the file.");
      await db.flashcard.create({ data: { ...inSpace, documentId: f.id, front: op.front, back: op.back, sourcePage: op.page } });
      return done;
    }
    case "card_edit": {
      const data = { ...(op.front ? { front: op.front } : {}), ...(op.back ? { back: op.back } : {}) };
      if (Object.keys(data).length === 0) return fail("Nothing to change.");
      const r = await db.flashcard.updateMany({ where: { id: op.cardId, ...inSpace }, data });
      return r.count ? done : fail("Flashcard not found.");
    }
    case "card_delete": {
      const r = await db.flashcard.deleteMany({ where: { id: { in: op.cardIds }, ...inSpace } });
      return r.count === op.cardIds.length ? done : r.count ? { ok: true, error: `${op.cardIds.length - r.count} were already gone.` } : fail("Flashcards not found.");
    }
    case "card_due_now": {
      const r = await db.flashcard.updateMany({ where: { id: { in: op.cardIds }, ...inSpace }, data: { nextReviewAt: new Date() } });
      return r.count ? done : fail("Flashcards not found.");
    }
    case "question_add": {
      const f = await fileOk(op.fileId);
      if (!f) return fail("File not found.");
      if (f.pageCount && op.page > f.pageCount) return fail("That page isn't in the file.");
      const mc = op.type === "MULTIPLE_CHOICE";
      if (mc && (op.options.length < 2 || !op.options.includes(op.answer))) return fail("The answer must be one of the options.");
      await db.question.create({
        data: { ...inSpace, documentId: f.id, type: op.type, question: op.question, options: mc ? op.options : [], answer: op.answer, explanation: op.explanation, sourcePage: op.page },
      });
      return done;
    }
    case "question_edit": {
      const cur = await db.question.findFirst({ where: { id: op.questionId, ...inSpace }, select: { type: true, options: true, answer: true } });
      if (!cur) return fail("Question not found.");
      const options = cur.type === "MULTIPLE_CHOICE" ? (op.options ?? cur.options) : [];
      const answer = op.answer ?? cur.answer;
      if (cur.type === "MULTIPLE_CHOICE" && !options.includes(answer)) return fail("The answer must be one of the options.");
      await db.question.updateMany({
        where: { id: op.questionId, ...inSpace },
        data: { ...(op.question ? { question: op.question } : {}), options, answer, ...(op.explanation !== undefined ? { explanation: op.explanation } : {}) },
      });
      return done;
    }
    case "question_delete": {
      const r = await db.question.deleteMany({ where: { id: { in: op.questionIds }, ...inSpace } });
      return r.count ? done : fail("Questions not found.");
    }
    case "plan_rebuild": {
      await rebuildPlanSafely(userId, spaceId);
      return done;
    }
    case "creation_new": {
      const q = new URLSearchParams({ type: op.type });
      if (op.instruction) q.set("instruction", op.instruction);
      q.set("n", Date.now().toString(36));
      return { ok: true, link: `/spaces/${spaceId}/create/new?${q}` };
    }
    case "creation_open": {
      if (!(await creationOk(op.creationId))) return fail("Not found.");
      return { ok: true, link: `/spaces/${spaceId}/create/${op.creationId}` };
    }
    case "creation_rename": {
      if (!(await creationOk(op.creationId))) return fail("Not found.");
      const r = await renameCreation({ id: op.creationId, title: op.title });
      return r.ok ? done : fail(r.error);
    }
    case "creation_look": {
      if (!(await creationOk(op.creationId))) return fail("Not found.");
      const r = await setCreationLook({ id: op.creationId, ...(op.icon !== undefined ? { icon: op.icon } : {}), ...(op.banner !== undefined ? { banner: op.banner } : {}) });
      return r.ok ? done : fail(r.error);
    }
    case "creation_duplicate": {
      if (!(await creationOk(op.creationId))) return fail("Not found.");
      const r = await duplicateCreation({ id: op.creationId });
      return r.ok ? { ok: true, link: r.newId ? `/spaces/${spaceId}/create/${r.newId}` : undefined } : fail(r.error);
    }
    case "creation_delete": {
      if (!(await creationOk(op.creationId))) return fail("Not found.");
      const r = await deleteCreation({ id: op.creationId });
      return r.ok ? done : fail(r.error);
    }
  }
}
