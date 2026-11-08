import { MODELS, streamText } from "@/lib/ai/gemini";
import { aiErrorMessage } from "@/lib/ai/limit-message";
import { CREATE_SYSTEM, createInput } from "@/lib/ai/prompts";
import { aiProvider } from "@/lib/ai/study";
import { markdownToDoc } from "@/lib/creations/document";
import { citedIds, splitTitle, stripCitations, titleFrom } from "@/lib/creations/markdown-text";
import { creationAllowance, creationContext } from "@/lib/creations/queries";
import { CREATION_TYPES, INSTRUCTION_MAX, TITLE_MAX, TYPE_INFO, type CreationEvent } from "@/lib/creations/types";
import { db } from "@/lib/db";
import { currentWritingSpeed } from "@/lib/settings/writing-speed-server";
import type { Prisma } from "@/lib/generated/prisma/client";
import { auth } from "@clerk/nextjs/server";
import { RetryAfterError } from "inngest";
import { z } from "zod";

export const maxDuration = 60;

const body = z.object({
  type: z.enum(CREATION_TYPES),
  instruction: z.string().trim().max(INSTRUCTION_MAX).optional(),
  /** Regenerate: rewrite this existing creation instead of making a new one. */
  replaceId: z.string().min(1).max(64).optional(),
});

const json = (status: number, data: Record<string, unknown>) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

/** MOCK provider: a small grounded document from the excerpts. */
async function* mockWrite(kind: string, excerpts: { id: number; text: string }[]) {
  const lines = excerpts.slice(0, 4).map((e) => `- ${e.text.slice(0, 140).trim()} [${e.id}]`);
  const text =
    kind === "EMAIL"
      ? `Subject: About my files\n\nHi,\n\n${lines.join("\n")}\n\nBest,`
      : `# ${TYPE_INFO[kind as keyof typeof TYPE_INFO]?.label ?? "Notes"}\n\n## Key points\n\n${lines
          .map((l) => (kind === "CHECKLIST" ? l.replace(/^- /, "- [ ] ") : l))
          .join("\n")}`;
  for (const w of text.split(/(?<=\s)/)) {
    await new Promise((r) => setTimeout(r, 10));
    yield w;
  }
}

/**
 * POST /api/spaces/:id/creations → NDJSON CreationEvent lines.
 * The only way to make a new creation: signed in → owns the Space → has
 * ready files → free weekly limit → valid body. Then Vappi writes it live and
 * it's saved (as the editor document + the pages it cited) even if the
 * browser goes away. Stop keeps what was written.
 */
export async function POST(req: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { userId } = await auth();
  if (!userId) return json(401, { error: "signed_out" });

  const { spaceId } = await params;
  const space = await db.space.findFirst({ where: { id: spaceId, userId }, select: { id: true } });
  if (!space) return json(404, { error: "not_found" });

  let parsed;
  try {
    parsed = body.safeParse(await req.json());
  } catch {
    return json(400, { error: "invalid" });
  }
  if (!parsed.success) return json(400, { error: "invalid" });
  const { type } = parsed.data;
  const instruction = parsed.data.instruction || null;

  const ready = await db.document.count({ where: { userId, spaceId, status: "READY" } });
  if (ready === 0) return json(409, { error: "no_files" });

  const allowance = await creationAllowance(userId);
  if (!allowance.allowed) return json(403, { error: "limit", used: allowance.used, limit: allowance.limit });

  const info = TYPE_INFO[type];
  let creation: { id: string };
  if (parsed.data.replaceId) {
    const old = await db.creation.findFirst({ where: { id: parsed.data.replaceId, userId, spaceId }, select: { id: true } });
    if (!old) return json(404, { error: "not_found" });
    creation = await db.creation.update({
      where: { id: old.id },
      data: { type, instruction, status: "WRITING" },
      select: { id: true },
    });
  } else {
    creation = await db.creation.create({
      data: { userId, spaceId, type, title: info.label, icon: info.emoji, instruction, status: "WRITING" },
      select: { id: true },
    });
  }
  await db.usageEvent.create({ data: { userId, kind: "CREATION" } });
  const speed = await currentWritingSpeed(userId);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (e: CreationEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        } catch {
          open = false; // the browser left: keep writing so the creation is still saved
        }
      };
      // After the browser leaves the stream is cancelled and close() throws.
      const close = () => {
        try {
          controller.close();
        } catch {}
      };
      let text = "";
      let sources: Awaited<ReturnType<typeof creationContext>>["sources"] = [];
      try {
        send({ t: "speed", speed });
        send({ t: "created", id: creation.id, title: info.label });
        send({ t: "step", step: "search" });
        const ctx = await creationContext(userId, spaceId, `${info.label}: ${instruction ?? "the main ideas and key facts"}`);
        sources = ctx.sources;
        send({ t: "found", sources });

        const pieces =
          aiProvider() === "gemini"
            ? streamText({
                model: MODELS.smart,
                system: CREATE_SYSTEM,
                input: createInput(type, ctx.excerpts, ctx.overview, instruction),
                signal: req.signal,
                timeoutMs: 55_000,
                maxOutputTokens: 4096,
              })
            : mockWrite(type, ctx.excerpts);
        for await (const piece of pieces) {
          if (req.signal.aborted) break;
          text += piece;
          send({ t: "delta", text: piece });
        }
      } catch (err) {
        if (!req.signal.aborted && !text.trim()) {
          console.error("Create failed", err instanceof RetryAfterError ? "busy" : (err as Error)?.name);
          await db.creation.update({ where: { id: creation.id }, data: { status: "FAILED" } }).catch(() => {});
          send({
            t: "error",
            message: await aiErrorMessage(err, userId, "Couldn't create this right now. Try again."),
          });
          close();
          return;
        }
      }

      // Save: the editor document (citations become the "Made from" pages).
      const used = new Set(citedIds(text));
      const cited = sources.filter((s) => used.has(s.n));
      const { title: heading, body } = splitTitle(stripCitations(text).trim());
      const clean = body.trim();
      const title = (heading ?? titleFrom(clean) ?? info.label).slice(0, TITLE_MAX);
      try {
        await db.creation.update({
          where: { id: creation.id },
          data: {
            title,
            markdown: clean,
            content: clean ? (markdownToDoc(clean) as Prisma.InputJsonValue) : undefined,
            sources: cited.map((s) => ({ documentId: s.documentId, page: s.page })),
            // The browser left mid-writing: keep it as unfinished, so the editor offers "Continue writing".
            status: clean ? (req.signal.aborted ? "WRITING" : "READY") : "FAILED",
          },
        });
        send({ t: "done", markdown: clean, sources: cited, title });
      } catch (err) {
        console.error("Create save failed", (err as Error)?.name);
        send({ t: "error", message: "Couldn't save this creation. Try again." });
      }
      close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
