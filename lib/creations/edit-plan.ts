// The AI's edit plan for a creation (shared by the edit route and the editor;
// no server-only imports). Vappi returns the smallest operations that do what
// the user asked, and the browser applies them live, exactly where they belong.

import { z } from "zod";
import { BANNERS, EMOJIS, TITLE_MAX } from "./types";

const MD_MAX = 30_000;
const TEXT_MAX = 4_000;

export const editOpSchema = z.discriminatedUnion("op", [
  /** Exact words in one paragraph / heading / list item → new words (inline Markdown; "" deletes). */
  z.object({ op: z.literal("replace_text"), find: z.string().min(1).max(TEXT_MAX), replace: z.string().max(TEXT_MAX), all: z.boolean().optional() }),
  /** The highlighted text only. */
  z.object({ op: z.literal("replace_selection"), markdown: z.string().max(MD_MAX) }),
  /** Whole numbered blocks from..to (1-based, inclusive) → new Markdown blocks ("" deletes). */
  z.object({ op: z.literal("replace_blocks"), from: z.number().int().min(1), to: z.number().int().min(1), markdown: z.string().max(MD_MAX) }),
  /** New blocks after block N (0 = at the top). */
  z.object({ op: z.literal("insert"), after: z.number().int().min(0), markdown: z.string().min(1).max(MD_MAX) }),
  /** A new paragraph / list item right after the line that contains `anchor`. */
  z.object({ op: z.literal("insert_after_text"), anchor: z.string().min(1).max(TEXT_MAX), markdown: z.string().min(1).max(MD_MAX) }),
  z.object({ op: z.literal("set_title"), title: z.string().trim().min(1).max(TITLE_MAX) }),
  z.object({ op: z.literal("set_icon"), emoji: z.enum(EMOJIS as [string, ...string[]]) }),
  z.object({ op: z.literal("set_banner"), banner: z.enum(Object.keys(BANNERS) as [string, ...string[]]).nullable() }),
]);

export type EditOp = z.infer<typeof editOpSchema>;

export const editPlanSchema = z.object({
  /** What the request asks for that is in none of the files (the server keeps it off the page). */
  notInFiles: z.array(z.string().max(80)).max(10).optional(),
  reply: z.string().max(400),
  ops: z.array(editOpSchema).max(40),
});
export type EditPlan = z.infer<typeof editPlanSchema>;

/**
 * JSON schema for the model: one variant per op, each with its own required
 * fields (so the model can't leave out the new text). Zod above is the real check.
 */
const str = { type: "string" };
const int = { type: "integer" };
const variant = (op: string, props: Record<string, unknown>, required: string[]) => ({
  type: "object",
  properties: { op: { type: "string", enum: [op] }, ...props },
  required: ["op", ...required],
});
export const editPlanJsonSchema = {
  type: "object",
  properties: {
    notInFiles: {
      type: "array",
      items: { type: "string" },
      description:
        "Decide this FIRST. The things the instruction asks to add that appear in NONE of the files (checked against every file in <overview> and every excerpt, ignoring spelling and case). Each item is the shortest name of the thing, e.g. \"swimming\" — never generic words like \"day\" or \"drills\". Empty when the files cover everything asked.",
    },
    reply: { type: "string", description: "One short, friendly sentence for the chat saying what you changed (or why you couldn't)." },
    ops: {
      type: "array",
      items: {
        anyOf: [
          variant("replace_text", { find: str, replace: str, all: { type: "boolean" } }, ["find", "replace"]),
          variant("replace_selection", { markdown: str }, ["markdown"]),
          variant("replace_blocks", { from: int, to: int, markdown: str }, ["from", "to", "markdown"]),
          variant("insert", { after: int, markdown: str }, ["after", "markdown"]),
          variant("insert_after_text", { anchor: str, markdown: str }, ["anchor", "markdown"]),
          variant("set_title", { title: str }, ["title"]),
          variant("set_icon", { emoji: { type: "string", enum: EMOJIS } }, ["emoji"]),
          variant("set_banner", { banner: { type: "string", enum: [...Object.keys(BANNERS), "none"] } }, ["banner"]),
        ],
      },
    },
  },
  required: ["notInFiles", "reply", "ops"],
};

/** Model output → a valid plan ("none" banner → null; invalid ops are dropped, not fatal). */
export function parsePlan(raw: unknown): EditPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { reply?: unknown; ops?: unknown; notInFiles?: unknown };
  if (typeof r.reply !== "string" || !Array.isArray(r.ops)) return null;
  const ops: EditOp[] = [];
  for (const o of r.ops.slice(0, 40)) {
    const fixed = o && typeof o === "object" && (o as { banner?: unknown }).banner === "none" ? { ...o, banner: null } : o;
    const p = editOpSchema.safeParse(fixed);
    if (p.success) ops.push(p.data);
  }
  if (r.ops.length > 0 && ops.length === 0) return null; // all invalid → retry
  const notInFiles = Array.isArray(r.notInFiles)
    ? r.notInFiles.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, 80)).slice(0, 10)
    : [];
  return { reply: r.reply.slice(0, 400), ops, notInFiles };
}
