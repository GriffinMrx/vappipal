import "server-only";

import { generateJson, MODELS } from "@/lib/ai/gemini";
import { escapeTags, MANAGE_SYSTEM } from "@/lib/ai/prompts";
import { creationContext } from "@/lib/creations/queries";
import { BANNERS, CREATION_TYPES, EMOJIS, TYPE_INFO } from "@/lib/creations/types";
import { dayInZone } from "@/lib/dates";
import { db } from "@/lib/db";
import { spaceColorValues } from "@/lib/spaces/types";
import { DANGER_OPS, MANAGE_OPS_MAX, manageOpSchema, type ManageLine, type ManageOp } from "./types";

/**
 * Vappi plans changes to a Space from a chat message. The model sees a compact
 * list of the Space with SHORT REFS (F1 = a file, C3 = a flashcard, Q2 = a quiz
 * question, D1 = a creation) and excerpts from the files; it returns operations
 * on those refs. Here every ref is mapped back to a real id of THIS user's
 * Space (unknown refs are dropped), new cards/questions get their file + page
 * from the excerpt they cite, and the card's wording is written by us, not the AI.
 */

const CARDS_MAX = 300;
const QUESTIONS_MAX = 200;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const clean = (s: string) => escapeTags(s).replace(/\s+/g, " ").trim();

type Ref = { id: string; name: string };

export type ManagePlan = { reply: string; ops: ManageOp[]; lines: ManageLine[] };

export async function planManage(userId: string, spaceId: string, message: string, timeZone: string): Promise<ManagePlan> {
  const [space, files, cards, questions, creations] = await Promise.all([
    db.space.findFirst({ where: { id: spaceId, userId }, select: { name: true, color: true, goalDate: true, goalLabel: true } }),
    db.document.findMany({
      where: { userId, spaceId },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, status: true, pageCount: true, summary: { select: { short: true, long: true, keyTerms: true } } },
    }),
    db.flashcard.findMany({
      where: { userId, spaceId },
      orderBy: { createdAt: "asc" },
      take: CARDS_MAX,
      select: { id: true, front: true, back: true, documentId: true, sourcePage: true, nextReviewAt: true },
    }),
    db.question.findMany({
      where: { userId, spaceId },
      orderBy: { createdAt: "asc" },
      take: QUESTIONS_MAX,
      select: { id: true, question: true, type: true, documentId: true, sourcePage: true },
    }),
    db.creation.findMany({ where: { userId, spaceId }, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, type: true } }),
  ]);
  if (!space) return { reply: "I couldn't find this Space.", ops: [], lines: [] };

  const F = new Map<string, Ref>(), C = new Map<string, Ref>(), Q = new Map<string, Ref>(), D = new Map<string, Ref>();
  const fileRef = new Map<string, string>();
  files.forEach((f, i) => {
    F.set(`F${i + 1}`, { id: f.id, name: f.title });
    fileRef.set(f.id, `F${i + 1}`);
  });
  cards.forEach((c, i) => C.set(`C${i + 1}`, { id: c.id, name: c.front }));
  questions.forEach((q, i) => Q.set(`Q${i + 1}`, { id: q.id, name: q.question }));
  creations.forEach((c, i) => D.set(`D${i + 1}`, { id: c.id, name: c.title }));

  // Excerpts for new content: the closest passages, plus any page the message names.
  const ctx = await creationContext(userId, spaceId, message);
  const excerpts = ctx.sources.map((s, i) => ({ documentId: s.documentId, page: s.page, text: ctx.excerpts[i]?.text ?? "" }));
  const pages = [...message.matchAll(/\b(?:pages?|pg\.?|p\.)\s*(\d{1,4})/gi)].map((m) => Number(m[1])).slice(0, 4);
  if (pages.length) {
    const extra = await db.chunk.findMany({
      where: { userId, spaceId, page: { in: pages } },
      orderBy: [{ page: "asc" }, { index: "asc" }],
      take: 10,
      select: { documentId: true, page: true, text: true },
    });
    for (const x of extra) if (!excerpts.some((e) => e.text === x.text)) excerpts.push(x);
  }

  const today = dayInZone(timeZone);
  const goal = space.goalDate ? `${space.goalDate.toISOString().slice(0, 10)}${space.goalLabel ? ` (${clean(space.goalLabel)})` : ""}` : "none";
  const input = [
    `<space name="${clean(space.name)}" color="${space.color}" goal="${goal}" today="${today}" />`,
    `<files>\n${files
      .map((f) => {
        const s = f.summary;
        return `${fileRef.get(f.id)} | ${clean(f.title)} | ${f.status} | ${f.pageCount ?? "?"} pages${
          s ? `\n  short summary: ${clean(s.short)}\n  long summary: ${clip(clean(s.long), 2000)}\n  key terms: ${s.keyTerms.map(clean).join(", ")}` : ""
        }`;
      })
      .join("\n") || "(no files)"}\n</files>`,
    `<flashcards>\n${cards
      .map((c, i) => `C${i + 1} [${fileRef.get(c.documentId) ?? "?"} p.${c.sourcePage}${c.nextReviewAt <= new Date() ? ", due" : ""}] ${clip(clean(c.front), 120)} → ${clip(clean(c.back), 80)}`)
      .join("\n") || "(none)"}\n</flashcards>`,
    `<quiz_questions>\n${questions
      .map((q, i) => `Q${i + 1} [${fileRef.get(q.documentId) ?? "?"} p.${q.sourcePage}, ${q.type === "MULTIPLE_CHOICE" ? "multiple choice" : "short answer"}] ${clip(clean(q.question), 140)}`)
      .join("\n") || "(none)"}\n</quiz_questions>`,
    `<creations>\n${creations.map((c, i) => `D${i + 1} | ${TYPE_INFO[c.type].label} | ${clean(c.title)}`).join("\n") || "(none)"}\n</creations>`,
    `<file_material>\n${excerpts
      .map((e, i) => `<excerpt n="${i + 1}" file="${fileRef.get(e.documentId) ?? "?"}" page="${e.page}">\n${escapeTags(e.text)}\n</excerpt>`)
      .join("\n")}\n</file_material>`,
    `<message>\n${escapeTags(message)}\n</message>`,
  ].join("\n");

  let raw: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    raw = await generateJson({ model: MODELS.smart, system: MANAGE_SYSTEM, input, schema: aiSchema, maxOutputTokens: 12_000, timeoutMs: 50_000, thinkingLevel: "minimal" });
    if (raw && typeof raw === "object" && Array.isArray((raw as { ops?: unknown }).ops)) break;
  }
  const r = (raw ?? {}) as { reply?: unknown; ops?: unknown };
  const reply = typeof r.reply === "string" && r.reply.trim() ? r.reply.trim().slice(0, 500) : "I couldn't work out what to change. Try saying it another way.";
  const ops: ManageOp[] = [];
  const lines: ManageLine[] = [];
  const fileName = (id: string) => files.find((f) => f.id === id)?.title ?? "file";
  for (const o of Array.isArray(r.ops) ? r.ops.slice(0, MANAGE_OPS_MAX) : []) {
    const op = resolve(o as Record<string, unknown>, { F, C, Q, D, excerpts });
    if (!op) continue;
    const p = manageOpSchema.safeParse(op);
    if (!p.success) continue;
    ops.push(p.data);
    lines.push({ label: describe(p.data, { fileName, C, Q, D }), danger: DANGER_OPS.has(p.data.op) });
  }
  return { reply, ops, lines };
}

/** AI refs → real ids. Anything that doesn't resolve is dropped (returns null). */
function resolve(
  o: Record<string, unknown>,
  m: { F: Map<string, Ref>; C: Map<string, Ref>; Q: Map<string, Ref>; D: Map<string, Ref>; excerpts: { documentId: string; page: number }[] },
): Record<string, unknown> | null {
  const one = (map: Map<string, Ref>, v: unknown) => (typeof v === "string" ? map.get(v.trim().toUpperCase())?.id : undefined);
  const many = (map: Map<string, Ref>, v: unknown) => {
    const list = Array.isArray(v) ? [...new Set(v.map((x) => one(map, x)).filter((x): x is string => !!x))] : [];
    return list.length ? list : null;
  };
  const none = (v: unknown) => (v === "none" || v === "" || v === null ? null : v);
  const ex = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? m.excerpts[v - 1] : undefined);
  const opt = <T extends Record<string, unknown>>(x: T) => Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined && v !== ""));
  switch (o.op) {
    case "space_rename":
      return { op: o.op, name: o.name };
    case "space_color":
      return { op: o.op, color: o.color };
    case "space_goal":
      return { op: o.op, date: none(o.date), label: none(o.label) };
    case "file_rename":
    case "file_delete":
    case "file_retry":
    case "file_regenerate":
    case "summary_edit": {
      const fileId = one(m.F, o.file);
      if (!fileId) return null;
      const rest = { ...o };
      delete rest.file;
      return opt({ ...rest, fileId, keyTerms: Array.isArray(o.keyTerms) && o.keyTerms.length ? o.keyTerms : undefined });
    }
    case "card_add":
    case "question_add": {
      const e = ex(o.excerpt);
      if (!e) return null; // new content must come from an excerpt of the files
      const rest = { ...o };
      delete rest.excerpt;
      if (o.op === "question_add") {
        const options = Array.isArray(o.options) ? o.options : [];
        if (o.type === "MULTIPLE_CHOICE" && (options.length < 2 || !options.includes(o.answer))) return null;
        return { ...rest, options: o.type === "MULTIPLE_CHOICE" ? options : [], explanation: o.explanation ?? "", fileId: e.documentId, page: e.page };
      }
      return { ...rest, fileId: e.documentId, page: e.page };
    }
    case "card_edit": {
      const cardId = one(m.C, o.card);
      return cardId ? opt({ op: o.op, cardId, front: o.front, back: o.back }) : null;
    }
    case "card_delete":
    case "card_due_now": {
      const cardIds = many(m.C, o.cards);
      return cardIds ? { op: o.op, cardIds } : null;
    }
    case "question_edit": {
      const questionId = one(m.Q, o.ref);
      const options = Array.isArray(o.options) && o.options.length ? o.options : undefined;
      return questionId ? opt({ op: o.op, questionId, question: o.question, options, answer: o.answer, explanation: o.explanation }) : null;
    }
    case "question_delete": {
      const questionIds = many(m.Q, o.refs);
      return questionIds ? { op: o.op, questionIds } : null;
    }
    case "plan_rebuild":
      return { op: o.op };
    case "creation_new":
      return { op: o.op, type: o.type, instruction: typeof o.instruction === "string" ? o.instruction : "" };
    case "creation_rename":
    case "creation_duplicate":
    case "creation_delete":
    case "creation_open": {
      const creationId = one(m.D, o.creation);
      return creationId ? { op: o.op, creationId, ...(o.op === "creation_rename" ? { title: o.title } : {}) } : null;
    }
    case "creation_look": {
      const creationId = one(m.D, o.creation);
      if (!creationId) return null;
      return opt({ op: o.op, creationId, icon: o.icon === undefined ? undefined : none(o.icon), banner: o.banner === undefined ? undefined : none(o.banner) });
    }
    default:
      return null;
  }
}

const COLOR_NAME: Record<string, string> = { SLATE: "Slate", BLUE: "Blue", VIOLET: "Violet", PINK: "Pink", RED: "Red", ORANGE: "Orange", GREEN: "Green", TEAL: "Teal" };
const PART: Record<string, string> = { summary: "summary", flashcards: "flashcards", quiz: "quiz questions" };
const q = (s: string, n = 60) => `“${clip(s.replace(/\s+/g, " ").trim(), n)}”`;
const longDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** The card's line for one operation, from real data (never the AI's own words about what it does). */
function describe(op: ManageOp, m: { fileName: (id: string) => string; C: Map<string, Ref>; Q: Map<string, Ref>; D: Map<string, Ref> }): string {
  const nameIn = (map: Map<string, Ref>, id: string) => [...map.values()].find((r) => r.id === id)?.name ?? "";
  const list = (map: Map<string, Ref>, idList: string[]) => {
    const names = idList.slice(0, 3).map((id) => q(nameIn(map, id), 40));
    return `${names.join(", ")}${idList.length > 3 ? ` and ${idList.length - 3} more` : ""}`;
  };
  switch (op.op) {
    case "space_rename":
      return `Rename this Space to ${q(op.name)}`;
    case "space_color":
      return `Change the Space color to ${COLOR_NAME[op.color]}`;
    case "space_goal":
      return op.date ? `Set the goal: ${op.label ? `${op.label} on ` : ""}${longDay(op.date)}` : "Remove the goal date";
    case "file_rename":
      return `Rename file ${q(m.fileName(op.fileId))} to ${q(op.title)}`;
    case "file_delete":
      return `Delete file ${q(m.fileName(op.fileId))} with its summary, flashcards and quiz`;
    case "file_retry":
      return `Read ${q(m.fileName(op.fileId))} again`;
    case "file_regenerate":
      return `Make new ${PART[op.part]} for ${q(m.fileName(op.fileId))} (replaces the current ones)`;
    case "summary_edit":
      return `Rewrite the summary of ${q(m.fileName(op.fileId))}`;
    case "card_add":
      return `Add flashcard ${q(op.front)} · ${clip(m.fileName(op.fileId), 30)} p. ${op.page}`;
    case "card_edit":
      return `Edit flashcard ${q(nameIn(m.C, op.cardId))}`;
    case "card_delete":
      return `Delete ${op.cardIds.length} flashcard${op.cardIds.length === 1 ? "" : "s"}: ${list(m.C, op.cardIds)}`;
    case "card_due_now":
      return `Make ${op.cardIds.length} flashcard${op.cardIds.length === 1 ? "" : "s"} due now`;
    case "question_add":
      return `Add quiz question ${q(op.question)} · ${clip(m.fileName(op.fileId), 30)} p. ${op.page}`;
    case "question_edit":
      return `Edit quiz question ${q(nameIn(m.Q, op.questionId))}`;
    case "question_delete":
      return `Delete ${op.questionIds.length} quiz question${op.questionIds.length === 1 ? "" : "s"}: ${list(m.Q, op.questionIds)}`;
    case "plan_rebuild":
      return "Rebuild the study plan";
    case "creation_new":
      return `Create ${TYPE_INFO[op.type].label.toLowerCase()}${op.instruction ? `: ${q(op.instruction)}` : ""}`;
    case "creation_rename":
      return `Rename ${q(nameIn(m.D, op.creationId))} to ${q(op.title)}`;
    case "creation_look":
      return `Change the look of ${q(nameIn(m.D, op.creationId))}`;
    case "creation_duplicate":
      return `Duplicate ${q(nameIn(m.D, op.creationId))}`;
    case "creation_delete":
      return `Delete ${q(nameIn(m.D, op.creationId))}`;
    case "creation_open":
      return `Open ${q(nameIn(m.D, op.creationId))} to edit its text`;
  }
}

// JSON schema for the model: one variant per operation (Zod in types.ts is the real check).
const str = { type: "string" };
const int = { type: "integer" };
const strs = { type: "array", items: str };
const v = (op: string, props: Record<string, unknown>, required: string[]) => ({
  type: "object",
  properties: { op: { type: "string", enum: [op] }, ...props },
  required: ["op", ...required],
});
const aiSchema = {
  type: "object",
  properties: {
    reply: { type: "string", description: "1–2 short, friendly sentences for the chat: what you plan to change, or why you can't." },
    ops: {
      type: "array",
      items: {
        anyOf: [
          v("space_rename", { name: str }, ["name"]),
          v("space_color", { color: { type: "string", enum: [...spaceColorValues] } }, ["color"]),
          v("space_goal", { date: { type: "string", description: "YYYY-MM-DD, or \"none\" to remove" }, label: { type: "string", description: "e.g. Exam, or \"none\"" } }, ["date", "label"]),
          v("file_rename", { file: str, title: str }, ["file", "title"]),
          v("file_delete", { file: str }, ["file"]),
          v("file_retry", { file: str }, ["file"]),
          v("file_regenerate", { file: str, part: { type: "string", enum: ["summary", "flashcards", "quiz"] } }, ["file", "part"]),
          v("summary_edit", { file: str, short: str, long: str, keyTerms: strs }, ["file"]),
          v("card_add", { excerpt: int, front: str, back: str }, ["excerpt", "front", "back"]),
          v("card_edit", { card: str, front: str, back: str }, ["card"]),
          v("card_delete", { cards: strs }, ["cards"]),
          v("card_due_now", { cards: strs }, ["cards"]),
          v(
            "question_add",
            { excerpt: int, type: { type: "string", enum: ["MULTIPLE_CHOICE", "SHORT_ANSWER"] }, question: str, options: strs, answer: str, explanation: str },
            ["excerpt", "type", "question", "options", "answer", "explanation"],
          ),
          v("question_edit", { ref: str, question: str, options: strs, answer: str, explanation: str }, ["ref"]),
          v("question_delete", { refs: strs }, ["refs"]),
          v("plan_rebuild", {}, []),
          v("creation_new", { type: { type: "string", enum: [...CREATION_TYPES] }, instruction: str }, ["type", "instruction"]),
          v("creation_rename", { creation: str, title: str }, ["creation", "title"]),
          v("creation_look", { creation: str, icon: { type: "string", enum: [...EMOJIS, "none"] }, banner: { type: "string", enum: [...Object.keys(BANNERS), "none"] } }, ["creation"]),
          v("creation_duplicate", { creation: str }, ["creation"]),
          v("creation_delete", { creation: str }, ["creation"]),
          v("creation_open", { creation: str }, ["creation"]),
        ],
      },
    },
  },
  required: ["reply", "ops"],
};
