import "server-only";

import { hasProAccess } from "@/lib/billing/access";
import { sourcesFor } from "@/lib/chat/answer";
import { overviewFor, retrieve } from "@/lib/chat/context";
import type { ChatSource } from "@/lib/chat/types";
import { db } from "@/lib/db";
import { FREE_CREATIONS_PER_WEEK, QUIZ_WINDOW_DAYS } from "@/lib/plans";
import { currentEmbeddingModel, embedQuery } from "@/lib/ai/embeddings";
import { chunksMentioning, searchChunks, type ChunkMatch } from "@/lib/search/vector";
import { stripCitations, stripDocCitations } from "./markdown-text";
import { BANNERS, type BannerKey, type CreationListItem, type CreationSourceRef, type CreationView } from "./types";

const MAX_EXCERPTS = 18;
/** Closest passages taken from EACH ready file, so every file in the Space is represented. */
const PER_FILE = 3;

function parseRefs(value: unknown): CreationSourceRef[] {
  if (!Array.isArray(value)) return [];
  return value.filter((r): r is CreationSourceRef => typeof r?.documentId === "string" && typeof r?.page === "number");
}

/** A Space's creations, newest first. Always scoped by the user. */
export async function listCreations(userId: string, spaceId: string): Promise<CreationListItem[]> {
  const rows = await db.creation.findMany({
    where: { userId, spaceId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, type: true, title: true, icon: true, status: true, sources: true, updatedAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    icon: r.icon,
    status: r.status,
    pages: parseRefs(r.sources).length,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/** One creation owned by the user (in that Space), with its source pages. */
export async function getCreation(userId: string, spaceId: string, id: string): Promise<CreationView | null> {
  const r = await db.creation.findFirst({ where: { id, userId, spaceId } });
  if (!r) return null;
  const refs = parseRefs(r.sources);
  const sources = await sourcesFor(
    userId,
    refs.map((s, i) => ({ n: i + 1, ...s })),
  );
  return {
    id: r.id,
    spaceId: r.spaceId,
    type: r.type,
    title: r.title,
    icon: r.icon,
    banner: r.banner && r.banner in BANNERS ? (r.banner as BannerKey) : null,
    instruction: r.instruction,
    status: r.status,
    content: r.content ? stripDocCitations(r.content) : r.content,
    markdown: r.markdown ? stripCitations(r.markdown) : r.markdown,
    sources,
    pages: refs.length,
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** Free: new creations in the last 7 days vs the weekly limit. Pro: unlimited. */
export async function creationAllowance(userId: string, now = new Date()) {
  if (await hasProAccess(userId, now)) return { allowed: true, used: 0, limit: null as number | null, pro: true };
  const used = await db.usageEvent.count({
    where: { userId, kind: "CREATION", createdAt: { gt: new Date(now.getTime() - QUIZ_WINDOW_DAYS * 86_400_000) } },
  });
  return { allowed: used < FREE_CREATIONS_PER_WEEK, used, limit: FREE_CREATIONS_PER_WEEK as number | null, pro: false };
}

/**
 * What the AI may use: the files' summaries + key terms, the 3 passages of EACH
 * ready file closest to `query` (so a request about two files sees both), the
 * passages closest overall, and the first passage of each key term (all in THIS Space).
 */
export async function creationContext(userId: string, spaceId: string, query: string) {
  const [matches, { ready, overview }, perFile] = await Promise.all([
    retrieve(userId, spaceId, query, null),
    overviewFor(userId, spaceId),
    closestPerFile(userId, spaceId, query),
  ]);
  const terms = [...new Set(overview.flatMap((o) => o.keyTerms))].slice(0, 10);
  const termChunks = ready ? await chunksMentioning({ userId, spaceId, terms }) : [];
  const picked = new Map<string, { id: string; documentId: string; page: number; text: string }>();
  for (const m of [...perFile, ...matches, ...termChunks]) if (!picked.has(m.id) && picked.size < MAX_EXCERPTS) picked.set(m.id, m);

  const docs = await db.document.findMany({
    where: { userId, spaceId, id: { in: [...new Set([...picked.values()].map((m) => m.documentId))] } },
    select: { id: true, title: true, fileType: true },
  });
  const byId = new Map(docs.map((d) => [d.id, d]));
  const usable = [...picked.values()].filter((m) => byId.has(m.documentId));
  const excerpts = usable.map((m, i) => ({ id: i + 1, page: m.page, doc: byId.get(m.documentId)!.title, text: m.text }));
  const sources: ChatSource[] = usable.map((m, i) => {
    const d = byId.get(m.documentId)!;
    return { n: i + 1, documentId: d.id, title: d.title, fileType: d.fileType, page: m.page };
  });
  return { ready, overview, excerpts, sources };
}

/** Each ready file's closest passages, interleaved (file 1 best, file 2 best, file 1 second…). */
async function closestPerFile(userId: string, spaceId: string, query: string) {
  const files = await db.document.findMany({ where: { userId, spaceId, status: "READY" }, select: { id: true } });
  if (files.length < 2) return []; // one file: the overall search already covers it
  const embedding = await embedQuery(query);
  const model = currentEmbeddingModel();
  const lists = await Promise.all(
    files.map((f) => searchChunks({ userId, spaceId, documentId: f.id, embedding, limit: PER_FILE, model })),
  );
  const out: ChunkMatch[] = [];
  for (let i = 0; i < PER_FILE; i++) for (const list of lists) if (list[i]) out.push(list[i]);
  return out;
}
