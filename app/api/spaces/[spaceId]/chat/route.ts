import { aiErrorMessage } from "@/lib/ai/limit-message";
import { hasProAccess } from "@/lib/billing/access";
import { answerQuestion } from "@/lib/chat/answer";
import { canRegenerate, chatAllowance } from "@/lib/chat/queries";
import { CHAT_MESSAGE_MAX, DOCUMENT_CONTEXT_MAX, type ChatEvent } from "@/lib/chat/types";
import { db } from "@/lib/db";
import { isManageRequest } from "@/lib/manage/intent";
import { planManage } from "@/lib/manage/plan";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

/** The answer streams; generation is capped well below this. */
export const maxDuration = 60;

const body = z.object({
  clientId: z.string().trim().min(1).max(64),
  message: z.string().trim().min(1).max(CHAT_MESSAGE_MAX),
  /** Re-answer this (latest) question, replacing its answer. */
  regenerate: z.boolean().optional(),
  /** The creation open in the Create editor (the user's own text): context for "this / it". */
  document: z
    .object({ title: z.string().trim().max(200), markdown: z.string().max(DOCUMENT_CONTEXT_MAX) })
    .optional(),
});

const json = (status: number, data: Record<string, unknown>) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

/**
 * POST /api/spaces/:id/chat → NDJSON stream of ChatEvent lines.
 * Checks before any AI call: signed in → owns the space → Pro → valid body → rate limit.
 */
export async function POST(req: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { userId } = await auth();
  if (!userId) return json(401, { error: "signed_out" });

  const { spaceId } = await params;
  const space = await db.space.findFirst({ where: { id: spaceId, userId }, select: { id: true } });
  if (!space) return json(404, { error: "not_found" });

  if (!(await hasProAccess(userId))) return json(403, { error: "pro" });

  let parsed;
  try {
    parsed = body.safeParse(await req.json());
  } catch {
    return json(400, { error: "invalid" });
  }
  if (!parsed.success) return json(400, { error: "invalid" });

  if (parsed.data.regenerate) {
    const check = await canRegenerate(userId, spaceId, parsed.data.clientId);
    if (check === "not_found") return json(404, { error: "not_found" });
    if (check === "not_latest") return json(409, { error: "not_latest" });
    if (check === "rate_limited") return json(429, { error: "rate_limited", limit: 10 });
  } else {
    const allowance = await chatAllowance(userId);
    if (!allowance.allowed) return json(429, { error: "rate_limited", limit: allowance.limit });
  }

  // Count it before answering (the hourly limits read these, not the messages).
  await db.usageEvent.create({ data: { userId, kind: parsed.data.regenerate ? "REGENERATE" : "CHAT" } });

  const encoder = new TextEncoder();
  // "Rename this space…", "delete the cards about…": Vappi plans the changes (shown in
  // the chat, not saved; nothing changes until the user confirms the plan).
  let manage = false;
  if (!parsed.data.regenerate) {
    const [files, creations] = await Promise.all([
      db.document.findMany({ where: { userId, spaceId }, select: { title: true } }),
      db.creation.findMany({ where: { userId, spaceId }, select: { title: true } }),
    ]);
    manage = await isManageRequest(parsed.data.message, {
      names: [...files, ...creations].map((x) => x.title),
      openTitle: parsed.data.document?.title ?? null,
    });
  }
  const events = manage
    ? manageEvents(userId, spaceId, parsed.data.message)
    : answerQuestion({ userId, spaceId, ...parsed.data, signal: req.signal });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (e: ChatEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        } catch {
          open = false; // client went away; keep going so a stopped answer is still saved
        }
      };
      try {
        for await (const e of events) send(e);
      } catch (err) {
        console.error("Chat stream failed", (err as Error)?.name);
        send({ t: "error", message: await aiErrorMessage(err, userId, "Couldn't answer right now. Try again.") });
      } finally {
        if (open) {
          try {
            controller.close();
          } catch {}
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function* manageEvents(userId: string, spaceId: string, message: string): AsyncGenerator<ChatEvent> {
  yield { t: "step", step: "search" };
  const user = await db.user.findUnique({ where: { id: userId }, select: { timeZone: true } });
  const plan = await planManage(userId, spaceId, message, user?.timeZone ?? "UTC");
  yield { t: "manage", reply: plan.reply, lines: plan.lines, ops: plan.ops };
}
