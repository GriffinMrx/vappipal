// Vappi manages a Space from the side chat (prompt 35). Shared by the server
// and the chat card (no server-only imports). The AI proposes a plan of these
// operations; nothing changes until the user presses "Do it", and the server
// re-checks every operation (ownership, Pro, limits) when it runs it.

import { z } from "zod";
import { BANNERS, CREATION_TYPES, EMOJIS, INSTRUCTION_MAX, TITLE_MAX } from "@/lib/creations/types";
import { GOAL_LABEL_MAX } from "@/lib/spaces/goal";
import { spaceColorValues } from "@/lib/spaces/types";

export const MANAGE_OPS_MAX = 40;

const id = z.string().min(1).max(64);
const ids = z.array(id).min(1).max(300);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const page = z.number().int().min(1).max(100_000);
const front = z.string().trim().min(1).max(600);
const back = z.string().trim().min(1).max(1500);
const qText = z.string().trim().min(1).max(1000);
const option = z.string().trim().min(1).max(300);
const explanation = z.string().trim().max(1500);

/** One change, with real ids (resolved on the server from the AI's short refs). */
export const manageOpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("space_rename"), name: z.string().trim().min(1).max(60) }),
  z.object({ op: z.literal("space_color"), color: z.enum(spaceColorValues) }),
  z.object({ op: z.literal("space_goal"), date: day.nullable(), label: z.string().trim().max(GOAL_LABEL_MAX).nullable() }),
  z.object({ op: z.literal("file_rename"), fileId: id, title: z.string().trim().min(1).max(200) }),
  z.object({ op: z.literal("file_delete"), fileId: id }),
  z.object({ op: z.literal("file_retry"), fileId: id }),
  z.object({ op: z.literal("file_regenerate"), fileId: id, part: z.enum(["summary", "flashcards", "quiz"]) }),
  z.object({
    op: z.literal("summary_edit"),
    fileId: id,
    short: z.string().trim().min(1).max(600).optional(),
    long: z.string().trim().min(1).max(8000).optional(),
    keyTerms: z.array(z.string().trim().min(1).max(80)).max(15).optional(),
  }),
  z.object({ op: z.literal("card_add"), fileId: id, page, front, back }),
  z.object({ op: z.literal("card_edit"), cardId: id, front: front.optional(), back: back.optional() }),
  z.object({ op: z.literal("card_delete"), cardIds: ids }),
  z.object({ op: z.literal("card_due_now"), cardIds: ids }),
  z.object({
    op: z.literal("question_add"),
    fileId: id,
    page,
    type: z.enum(["MULTIPLE_CHOICE", "SHORT_ANSWER"]),
    question: qText,
    options: z.array(option).max(6),
    answer: z.string().trim().min(1).max(1000),
    explanation,
  }),
  z.object({
    op: z.literal("question_edit"),
    questionId: id,
    question: qText.optional(),
    options: z.array(option).min(2).max(6).optional(),
    answer: z.string().trim().min(1).max(1000).optional(),
    explanation: explanation.optional(),
  }),
  z.object({ op: z.literal("question_delete"), questionIds: ids }),
  z.object({ op: z.literal("plan_rebuild") }),
  z.object({ op: z.literal("creation_new"), type: z.enum(CREATION_TYPES), instruction: z.string().trim().max(INSTRUCTION_MAX) }),
  z.object({ op: z.literal("creation_rename"), creationId: id, title: z.string().trim().min(1).max(TITLE_MAX) }),
  z.object({
    op: z.literal("creation_look"),
    creationId: id,
    icon: z.enum(EMOJIS as [string, ...string[]]).nullable().optional(),
    banner: z.enum(Object.keys(BANNERS) as [string, ...string[]]).nullable().optional(),
  }),
  z.object({ op: z.literal("creation_duplicate"), creationId: id }),
  z.object({ op: z.literal("creation_delete"), creationId: id }),
  z.object({ op: z.literal("creation_open"), creationId: id }),
]);

export type ManageOp = z.infer<typeof manageOpSchema>;

/** What the card shows for one operation (written by the server, not the AI). */
export type ManageLine = { label: string; danger: boolean };

/** The result of one operation after "Do it". `link` opens a creation. */
export type ManageResult = { ok: boolean; error?: string; link?: string };

export type ApplyManageResult = { ok: true; results: ManageResult[] } | { ok: false; error: string };

export const DANGER_OPS = new Set<ManageOp["op"]>(["file_delete", "card_delete", "question_delete", "creation_delete"]);
