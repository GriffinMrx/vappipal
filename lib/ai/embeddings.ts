import "server-only";

import { EMBEDDING_DIMENSIONS } from "@/lib/search/vector";
import { embedTexts, MODELS } from "./gemini";

/**
 * Text embeddings (1536 dims, matching the Chunk.embedding column).
 * EMBEDDING_PROVIDER=gemini (default when GEMINI_API_KEY is set) | mock.
 * Each vector is stored with the model that made it (Chunk.embeddingModel):
 * search only compares vectors from the CURRENT model (AGENTS.md §12).
 *
 * gemini-embedding-2 takes no task type; it uses text prefixes instead, and
 * documents and queries must use the matching formats.
 */

export function embeddingProvider(): "gemini" | "mock" {
  const p = process.env.EMBEDDING_PROVIDER || (process.env.GEMINI_API_KEY ? "gemini" : "mock");
  if (p !== "gemini" && p !== "mock") throw new Error(`Embedding provider "${p}" is not supported`);
  return p;
}

/**
 * Pacing for batch embedding jobs. Gemini free tier allows 100 embed requests
 * per minute, and every chunk in a batch counts as one request: embed 45, then
 * wait 30 s (≈ 90 / minute). The mock needs no pause.
 */
export function embedPacing(): { batch: number; pause: string | null } {
  return embeddingProvider() === "gemini"
    ? { batch: Number(process.env.EMBED_BATCH) || 45, pause: process.env.EMBED_PAUSE || "30s" }
    : { batch: 50, pause: null };
}

/** Name stored in Chunk.embeddingModel for the current provider. */
export function currentEmbeddingModel(): string {
  return embeddingProvider() === "gemini" ? MODELS.embedding : "mock-hash";
}

/** Embed document chunks (`title` = the document's title, for the prefix). */
export async function embedDocuments(items: { title: string; text: string }[]): Promise<number[][]> {
  if (embeddingProvider() === "mock") return items.map((i) => hashEmbedding(i.text));
  const title = (t: string) => t.replace(/\|/g, "/").slice(0, 200) || "none";
  return embedTexts(items.map((i) => `title: ${title(i.title)} | text: ${i.text}`));
}

/** Embed a search query (used by chat). */
export async function embedQuery(query: string): Promise<number[]> {
  if (embeddingProvider() === "mock") return hashEmbedding(query);
  return (await embedTexts([`task: search result | query: ${query}`]))[0];
}

/** Kept for existing callers/tests: plain texts, document style. */
export async function embed(texts: string[]): Promise<number[][]> {
  return embedDocuments(texts.map((text) => ({ title: "none", text })));
}

/** FNV-1a 32-bit. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const STOP = new Set(
  "a an and are as at be by for from has have in is it its of on or that the this to was were will with".split(" "),
);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().normalize("NFKD").match(/[\p{L}\p{N}]+/gu) ?? []).filter(
    (w) => w.length > 1 && !STOP.has(w),
  );
}

/** MOCK: deterministic feature hashing (similar text → similar vectors). */
export function hashEmbedding(text: string): number[] {
  const v = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const words = tokenize(text);
  const add = (feature: string, weight: number) => {
    const h = fnv1a(feature);
    v[h % EMBEDDING_DIMENSIONS] += (h & 0x80000000 ? -1 : 1) * weight;
  };
  for (let i = 0; i < words.length; i++) {
    add(words[i], 1);
    if (i + 1 < words.length) add(`${words[i]} ${words[i + 1]}`, 0.5);
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  if (norm === 0) {
    v[0] = 1;
    return v;
  }
  return v.map((x) => Number((x / norm).toFixed(6)));
}
