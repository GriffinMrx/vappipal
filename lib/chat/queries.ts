import "server-only";

import { db } from "@/lib/db";
import { CHAT_LIMITS } from "@/lib/plans";
import { sourcesFor } from "./answer";
import type { ChatMessageView } from "./types";

type StoredCitation = { n: number; documentId: string; page: number };

function parseCitations(value: unknown): StoredCitation[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (c): c is StoredCitation =>
      typeof c?.n === "number" && typeof c?.documentId === "string" && typeof c?.page === "number",
  );
}

/** The last `take` messages of a space's chat, oldest first. Scoped to the user. */
export async function listChatMessages(userId: string, spaceId: string, take = 50): Promise<ChatMessageView[]> {
  const rows = (
    await db.chatMessage.findMany({
      where: { userId, spaceId },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, role: true, content: true, citations: true, createdAt: true, clientId: true },
    })
  ).reverse();
  const all = rows.flatMap((r) => parseCitations(r.citations));
  const sources = await sourcesFor(userId, all);
  const key = (documentId: string, page: number) => `${documentId}:${page}`;
  const known = new Set(sources.map((s) => key(s.documentId, s.page)));
  const meta = new Map(sources.map((s) => [s.documentId, s]));
  return rows.map((r) => ({
    id: r.id,
    role: r.role === "USER" ? "user" : "assistant",
    content: r.content,
    sources: parseCitations(r.citations)
      .filter((c) => known.has(key(c.documentId, c.page)))
      .map((c) => ({ ...meta.get(c.documentId)!, n: c.n, page: c.page })),
    createdAt: r.createdAt.toISOString(),
    clientId: r.role === "USER" ? r.clientId : null,
  }));
}

/**
 * Regenerate check: the question must be the user's latest in this space,
 * and regenerates are capped per hour. Counted as usage events, so clearing
 * the chat can't reset it.
 */
export async function canRegenerate(userId: string, spaceId: string, clientId: string, now = new Date()) {
  const question = await db.chatMessage.findUnique({
    where: { userId_clientId: { userId, clientId } },
    select: { spaceId: true, createdAt: true, role: true },
  });
  if (!question || question.spaceId !== spaceId || question.role !== "USER") return "not_found" as const;
  const later = await db.chatMessage.count({
    where: { userId, spaceId, role: "USER", createdAt: { gt: question.createdAt } },
  });
  if (later > 0) return "not_latest" as const;
  const used = await db.usageEvent.count({
    where: { userId, kind: "REGENERATE", createdAt: { gt: new Date(now.getTime() - 3_600_000) } },
  });
  if (used >= REGENERATES_PER_HOUR) return "rate_limited" as const;
  return "ok" as const;
}

const REGENERATES_PER_HOUR = 10;

/** Messages the user sent in the last hour (cost guard). Usage events survive clearing the chat. */
export async function chatAllowance(userId: string, now = new Date()) {
  const used = await db.usageEvent.count({
    where: { userId, kind: "CHAT", createdAt: { gt: new Date(now.getTime() - 3_600_000) } },
  });
  return { allowed: used < CHAT_LIMITS.perHour, used, limit: CHAT_LIMITS.perHour };
}
