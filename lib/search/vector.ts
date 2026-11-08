import "server-only";

import { db } from "@/lib/db";

/** Fixed by the embedding model (EMBEDDING_MODEL). Changing it = re-embed all chunks (`npm run reembed`). */
export const EMBEDDING_DIMENSIONS = 1536;

export type ChunkMatch = {
  id: string;
  documentId: string;
  page: number;
  text: string;
  /** Cosine distance: 0 = identical, 2 = opposite. */
  distance: number;
};

function toVectorLiteral(embedding: number[]): string {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding must have ${EMBEDDING_DIMENSIONS} dimensions, got ${embedding.length}`);
  }
  if (!embedding.every(Number.isFinite)) throw new Error("Embedding contains a non-finite number");
  return `[${embedding.join(",")}]`;
}

/**
 * Closest chunks to `embedding` within ONE user's ONE space
 * (AGENTS.md §12: without both filters, one user's chat could read
 * another's notes). Tagged-template parameters only.
 */
export async function searchChunks({
  userId,
  spaceId,
  embedding,
  limit = 8,
  model,
  documentId,
}: {
  userId: string;
  spaceId: string;
  embedding: number[];
  limit?: number;
  /** Only compare vectors made by this embedding model (never mix models). */
  model?: string;
  /** Only this file (still within the user's Space). */
  documentId?: string;
}): Promise<ChunkMatch[]> {
  const vector = toVectorLiteral(embedding);
  const take = Math.min(Math.max(Math.trunc(limit), 1), 50);
  // The Space column keeps its database name "subjectId" (Prisma @map).
  return db.$queryRaw<ChunkMatch[]>`
    SELECT "id", "documentId", "page", "text",
           ("embedding" <=> ${vector}::vector)::float8 AS "distance"
    FROM "Chunk"
    WHERE "userId" = ${userId}
      AND "subjectId" = ${spaceId}
      AND "embedding" IS NOT NULL
      AND (${model ?? null}::text IS NULL OR "embeddingModel" = ${model ?? null})
      AND (${documentId ?? null}::text IS NULL OR "documentId" = ${documentId ?? null})
    ORDER BY "embedding" <=> ${vector}::vector
    LIMIT ${take}
  `;
}

/** Store many embeddings in one statement (scoped to their owner). Returns rows updated. */
export async function saveChunkEmbeddings(
  userId: string,
  items: { chunkId: string; embedding: number[] }[],
  model: string,
): Promise<number> {
  if (items.length === 0) return 0;
  const ids = items.map((i) => i.chunkId);
  const vectors = items.map((i) => toVectorLiteral(i.embedding));
  return db.$executeRaw`
    UPDATE "Chunk" AS c SET "embedding" = v.e::vector, "embeddingModel" = ${model}
    FROM unnest(${ids}::text[], ${vectors}::text[]) AS v(id, e)
    WHERE c."id" = v.id AND c."userId" = ${userId}
  `;
}

/** Chunks with no vector, or a vector from another model (they need re-embedding). */
export async function chunksWithoutEmbedding(documentId: string, userId: string, limit: number, model: string) {
  return db.$queryRaw<{ id: string; text: string }[]>`
    SELECT "id", "text" FROM "Chunk"
    WHERE "documentId" = ${documentId} AND "userId" = ${userId}
      AND ("embedding" IS NULL OR "embeddingModel" IS DISTINCT FROM ${model})
    ORDER BY "index"
    LIMIT ${limit}
  `;
}

/** Store a chunk's embedding (scoped to its owner). Returns false if no row matched. */
export async function saveChunkEmbedding(
  chunkId: string,
  userId: string,
  embedding: number[],
): Promise<boolean> {
  const vector = toVectorLiteral(embedding);
  const updated = await db.$executeRaw`
    UPDATE "Chunk" SET "embedding" = ${vector}::vector
    WHERE "id" = ${chunkId} AND "userId" = ${userId}
  `;
  return updated === 1;
}

/**
 * For each key term, the first chunk (reading order) that mentions it, within
 * ONE user's ONE Space. Lets whole-file questions ("what are the key terms?")
 * cite real pages. Parameters only; LIKE wildcards in terms are escaped.
 */
export async function chunksMentioning({
  userId,
  spaceId,
  terms,
}: {
  userId: string;
  spaceId: string;
  terms: string[];
}): Promise<(Omit<ChunkMatch, "distance"> & { term: string })[]> {
  const clean = [...new Set(terms.map((t) => t.trim()).filter((t) => t.length >= 2))].slice(0, 12);
  if (clean.length === 0) return [];
  const patterns = clean.map((t) => `%${t.replace(/[\\%_]/g, (c) => "\\" + c)}%`);
  // The Space column keeps its database name "subjectId" (Prisma @map).
  return db.$queryRaw`
    SELECT DISTINCT ON (t.term) t.term AS "term", c."id", c."documentId", c."page", c."text"
    FROM unnest(${clean}::text[], ${patterns}::text[]) AS t(term, pattern)
    JOIN "Chunk" c
      ON c."userId" = ${userId}
     AND c."subjectId" = ${spaceId}
     AND c."text" ILIKE t.pattern
    ORDER BY t.term, c."documentId", c."index"
  `;
}
