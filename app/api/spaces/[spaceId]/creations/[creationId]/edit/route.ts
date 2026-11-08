import { generateJson, MODELS } from "@/lib/ai/gemini";
import { aiErrorMessage } from "@/lib/ai/limit-message";
import { EDIT_SYSTEM, editInput } from "@/lib/ai/prompts";
import { aiProvider } from "@/lib/ai/study";
import { hasProAccess } from "@/lib/billing/access";
import { editPlanJsonSchema, parsePlan, type EditOp, type EditPlan } from "@/lib/creations/edit-plan";
import { citedIds, stripCitations } from "@/lib/creations/markdown-text";
import { classifyCreationMessage } from "@/lib/creations/intent";
import { guardOps } from "@/lib/creations/topic-guard";
import { creationContext } from "@/lib/creations/queries";
import { CREATE_EDITS_PER_HOUR, EDIT_INSTRUCTION_MAX, TITLE_MAX, type CreationEvent } from "@/lib/creations/types";
import { db } from "@/lib/db";
import { isManageRequest } from "@/lib/manage/intent";
import { currentWritingSpeed } from "@/lib/settings/writing-speed-server";
import { auth } from "@clerk/nextjs/server";
import { RetryAfterError } from "inngest";
import { z } from "zod";

export const maxDuration = 60;

const body = z
  .object({
    instruction: z.string().trim().min(1).max(EDIT_INSTRUCTION_MAX),
    /** The document as Markdown, one string per top-level block (numbered 1..n for the AI). */
    blocks: z.array(z.string().max(20_000)).max(400),
    page: z.object({
      title: z.string().max(TITLE_MAX + 20),
      icon: z.string().max(16).nullable(),
      banner: z.string().max(20).nullable(),
    }),
    /** The highlighted text (plain), the block it starts in, and whether it stays inside one block. */
    selection: z.object({ text: z.string().min(1).max(20_000), block: z.number().int().min(1), inline: z.boolean() }).nullable(),
    /** From the side chat: decide first whether this is an edit or a question ("ask" → {t:"ask"}). */
    auto: z.boolean().optional(),
    /** The latest side-chat turns, so follow-ups ("yes", "both of them") make sense. Never a source of facts. */
    history: z
      .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(600) }))
      .max(8)
      .optional(),
  })
  .refine((b) => b.blocks.reduce((n, s) => n + s.length, 0) <= 60_000, "too long");

const json = (status: number, data: Record<string, unknown>) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

const line = (e: CreationEvent) => `${JSON.stringify(e)}\n`;

/** MOCK provider: a small, visible plan so the live edit can be seen without an AI key. */
function mockPlan(blocks: string[], selection: { text: string } | null): EditPlan {
  if (selection) return { reply: "I made your selection bold.", ops: [{ op: "replace_selection", markdown: `**${selection.text.trim()}**` }] };
  const first = blocks.findIndex((b) => b.trim());
  if (first < 0) return { reply: "The page is empty, so there was nothing to change.", ops: [] };
  return { reply: "I shortened the first part.", ops: [{ op: "replace_blocks", from: first + 1, to: first + 1, markdown: blocks[first].slice(0, 120) }] };
}

/** "edit the file", "this program", "my request"… with no other Space item named: it's the open page. */
const OPEN_PAGE = /\b(?:this|the|my|that)\s+(?:file|page|doc|document|program(?:me)?|text|note|notes|creation|draft)\b|\bmy request\b/i;
function aboutOpenPage(message: string, otherNames: string[]) {
  const lower = message.toLowerCase();
  return OPEN_PAGE.test(message) && !otherNames.some((n) => n.length >= 3 && lower.includes(n.toLowerCase()));
}

/**
 * The AI was busy (overloaded / per-minute rate limit): wait 2 s and try once
 * more before telling the user. The daily limit is not retried (RetryAfterError only).
 */
async function withBusyRetry<T>(call: () => Promise<T>, signal: AbortSignal): Promise<T> {
  try {
    return await call();
  } catch (err) {
    if (!(err instanceof RetryAfterError) || signal.aborted) throw err;
    await new Promise((r) => setTimeout(r, 2_000));
    if (signal.aborted) throw err;
    return call();
  }
}

/** Citation markers out of the new text; the excerpt ids they used are collected. */
function cleanOps(ops: EditOp[]) {
  const used = new Set<number>();
  const clean = (s: string) => {
    for (const n of citedIds(s)) used.add(n);
    return stripCitations(s);
  };
  const out = ops.map((o): EditOp => {
    if (o.op === "replace_text") return { ...o, replace: clean(o.replace) };
    if (o.op === "replace_selection" || o.op === "replace_blocks" || o.op === "insert" || o.op === "insert_after_text")
      return { ...o, markdown: clean(o.markdown) };
    return o;
  });
  return { ops: out, used };
}

/**
 * POST /api/spaces/:id/creations/:creationId/edit → NDJSON CreationEvent lines.
 * Pro only. Vappi returns an edit plan (the smallest operations that do what was asked);
 * the browser plays it live and autosaves. Owner only; capped per hour;
 * new facts only from the user's files.
 */
export async function POST(req: Request, { params }: { params: Promise<{ spaceId: string; creationId: string }> }) {
  const { userId } = await auth();
  if (!userId) return json(401, { error: "signed_out" });

  const { spaceId, creationId } = await params;
  const creation = await db.creation.findFirst({ where: { id: creationId, spaceId, userId }, select: { id: true, title: true } });
  if (!creation) return json(404, { error: "not_found" });
  // Vappi's AI editing is Pro only (enforced here; the UI only hides it).
  if (!(await hasProAccess(userId))) return json(403, { error: "pro" });

  let parsed;
  try {
    parsed = body.safeParse(await req.json());
  } catch {
    return json(400, { error: "invalid" });
  }
  if (!parsed.success) return json(400, { error: "invalid" });
  const { instruction, blocks, page, selection, auto, history = [] } = parsed.data;

  const used = await db.usageEvent.count({
    where: { userId, kind: "CREATE_EDIT", createdAt: { gt: new Date(Date.now() - 3_600_000) } },
  });
  if (used >= CREATE_EDITS_PER_HOUR) return json(429, { error: "rate_limited", limit: CREATE_EDITS_PER_HOUR });
  // A question about the document goes to the chat instead (nothing counted here).
  // About the rest of the Space ("delete the cards about…")? The chat plans that instead,
  // unless the message is plainly about the open page ("edit the file", "this program").
  const names = auto && !selection
    ? (
        await Promise.all([
          db.document.findMany({ where: { userId, spaceId }, select: { title: true } }),
          db.creation.findMany({ where: { userId, spaceId, id: { not: creationId } }, select: { title: true } }),
        ])
      )
        .flat()
        .map((x) => x.title)
    : [];
  const toChat =
    auto &&
    !selection &&
    !aboutOpenPage(instruction, names) &&
    (await isManageRequest(instruction, { names, openTitle: creation.title }));
  if (toChat || (auto && (await classifyCreationMessage(instruction, creation.title, selection !== null)) === "ask")) {
    return new Response(line({ t: "ask" }), {
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  await db.usageEvent.create({ data: { userId, kind: "CREATE_EDIT" } });
  const speed = await currentWritingSpeed(userId);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: CreationEvent) => {
        try {
          controller.enqueue(encoder.encode(line(e)));
        } catch {
          /* browser left */
        }
      };
      // After the browser leaves the stream is cancelled and close() throws.
      const close = () => {
        try {
          controller.close();
        } catch {}
      };
      try {
        emit({ t: "speed", speed });
        emit({ t: "step", step: "search" });
        // Search on what the user asked (plus their recent turns and any selection), not on
        // the page text: a page about one file would otherwise hide the Space's other files.
        const recent = history.filter((m) => m.role === "user").slice(-2).map((m) => m.content);
        const query = [...recent, instruction, selection?.text.slice(0, 600) ?? page.title].join("\n");
        const ctx = await creationContext(userId, spaceId, query);
        emit({ t: "found", sources: ctx.sources });

        let plan: EditPlan | null = null;
        if (aiProvider() === "gemini") {
          // Structured output, validated; one retry when it's invalid (AGENTS.md §7).
          const input = editInput(ctx.excerpts, page, blocks, selection, instruction, history, ctx.overview);
          for (let attempt = 0; attempt < 2 && !plan && !req.signal.aborted; attempt++) {
            const raw = await withBusyRetry(
              () =>
                generateJson({
                  model: MODELS.smart,
                  system: EDIT_SYSTEM,
                  input,
                  schema: editPlanJsonSchema,
                  maxOutputTokens: 12_000,
                  timeoutMs: 50_000,
                }),
              req.signal,
            );
            plan = parsePlan(raw);
          }
        } else plan = mockPlan(blocks, selection);
        if (req.signal.aborted) return close();
        if (!plan) throw new Error("invalid_plan");

        // Safety net: nothing the model itself flagged as "in none of the files" reaches the page.
        const guarded = guardOps(plan.ops, plan.notInFiles ?? [], blocks.join("\n"));
        if (guarded.blocked.length) {
          const named = guarded.blocked.join(", ");
          const reply = plan.reply;
          const said = guarded.blocked.every((b) => reply.toLowerCase().includes(b.toLowerCase()));
          plan = {
            ...plan,
            ops: guarded.ops,
            reply: said && guarded.ops.length === 0 ? reply : `Your files don't mention ${named}, so I didn't add it.${guarded.ops.length ? " I made the other changes." : ""}`,
          };
        }
        const { ops, used: ids } = cleanOps(plan.ops);
        const cited = ctx.sources.filter((s) => ids.has(s.n));
        // New pages the edit used join the creation's "Made from" list.
        if (cited.length) {
          const row = await db.creation.findUnique({ where: { id: creation.id }, select: { sources: true } });
          const refs = Array.isArray(row?.sources) ? (row.sources as { documentId: string; page: number }[]) : [];
          const key = (r: { documentId: string; page: number }) => `${r.documentId}:${r.page}`;
          const seen = new Set(refs.map(key));
          const merged = [...refs, ...cited.map((s) => ({ documentId: s.documentId, page: s.page })).filter((r) => !seen.has(key(r)))];
          await db.creation.update({ where: { id: creation.id }, data: { sources: merged } });
        }
        emit({ t: "plan", reply: plan.reply, ops, sources: cited });
      } catch (err) {
        if (!req.signal.aborted) {
          const kind = err instanceof RetryAfterError ? "busy" : (err as Error)?.message === "invalid_plan" ? "invalid_plan" : (err as Error)?.name;
          console.error("Create edit failed", kind);
          emit({
            t: "error",
            message: await aiErrorMessage(err, userId, "Couldn't edit right now. Try again."),
          });
        }
      }
      close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
