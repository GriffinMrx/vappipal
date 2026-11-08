import "server-only";

import { currentEmbeddingModel, embeddingProvider, embedQuery } from "@/lib/ai/embeddings";
import type { ChatOverview } from "@/lib/ai/prompts";
import { db } from "@/lib/db";
import { CHAT_LIMITS } from "@/lib/plans";
import { searchChunks, type ChunkMatch } from "@/lib/search/vector";

// What the AI may read about a Space: the closest passages and each file's
// saved summary + key terms. Shared by Ask (chat) and Create.

const TOP_K = 8;
/** Closest passages sent even when none is under the distance limit ("possibly related"). */
const MIN_PASSAGES = 4;
const SUMMARY_CHARS = 1500;

/** Cosine distance above which a passage doesn't count as relevant. */
function maxDistance() {
  if (CHAT_LIMITS.maxDistance !== undefined) return CHAT_LIMITS.maxDistance;
  // Measured with gemini-embedding-2: related questions 0.26–0.40, unrelated 0.41–0.53.
  return embeddingProvider() === "gemini" ? 0.5 : 0.95;
}

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export async function retrieve(userId: string, spaceId: string, question: string, previous: string | null) {
  const model = currentEmbeddingModel();
  const queries = [question];
  // Short follow-ups ("and the second one?") need the previous question for context.
  if (previous && wordCount(question) < 6) queries.push(`${previous}\n${question}`);
  const results = await Promise.all(
    queries.map(async (q) =>
      searchChunks({ userId, spaceId, embedding: await embedQuery(q), limit: TOP_K, model }),
    ),
  );
  const best = new Map<string, ChunkMatch>();
  for (const m of results.flat()) {
    const seen = best.get(m.id);
    if (!seen || m.distance < seen.distance) best.set(m.id, m);
  }
  const limit = maxDistance();
  const sorted = [...best.values()].sort((a, b) => a.distance - b.distance);
  const close = sorted.filter((m) => m.distance <= limit);
  // Broad questions ("what is this about?") match no single passage closely:
  // still send the nearest few rather than nothing.
  return (close.length >= 3 ? close : sorted.slice(0, Math.max(close.length, MIN_PASSAGES))).slice(0, TOP_K);
}

/** Saved summaries + key terms of the Space's ready files (no AI call). */
export async function overviewFor(userId: string, spaceId: string) {
  const docs = await db.document.findMany({
    where: { userId, spaceId, status: "READY" },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, summary: { select: { short: true, long: true, keyTerms: true } } },
  });
  const overview: ChatOverview[] = docs.flatMap((d) =>
    d.summary
      ? [
          {
            doc: d.title,
            summary: `${d.summary.short}\n${d.summary.long}`.slice(0, SUMMARY_CHARS),
            keyTerms: d.summary.keyTerms.slice(0, 15),
          },
        ]
      : [],
  );
  return { ready: docs.length, overview };
}

