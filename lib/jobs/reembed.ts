import "server-only";

import { currentEmbeddingModel, embedDocuments, embedPacing } from "@/lib/ai/embeddings";
import { db } from "@/lib/db";
import { chunksWithoutEmbedding, saveChunkEmbeddings } from "@/lib/search/vector";
import { NonRetriableError } from "inngest";
import { EVENTS, inngest, type DocumentUploadedData } from "./client";


/**
 * Re-embed a document's chunks whose vectors came from another model
 * (AGENTS.md §12: changing the embedding model means re-embedding).
 * Triggered by `npm run reembed`. Study material is not touched.
 */
export const reembedDocument = inngest.createFunction(
  {
    id: "reembed-document",
    triggers: [{ event: EVENTS.reembed }],
    retries: 4,
    concurrency: [{ limit: 2 }],
    throttle: { limit: 10, period: "1m" },
    singleton: { key: "event.data.documentId", mode: "skip" },
  },
  async ({ event, step }) => {
    const data = event.data as DocumentUploadedData;
    const doc = await step.run("load", async () => {
      const d = await db.document.findFirst({
        where: { id: data.documentId, userId: data.userId },
        select: { id: true, title: true },
      });
      if (!d) throw new NonRetriableError("Document no longer exists");
      return d;
    });
    const model = currentEmbeddingModel();
    const { batch, pause } = embedPacing();
    let total = 0;
    for (let i = 0; i < 1000; i++) {
      if (i > 0 && pause) await step.sleep(`pause-${i}`, pause);
      const n = await step.run(`embed-${i}`, async () => {
        const chunks = await chunksWithoutEmbedding(doc.id, data.userId, batch, model);
        if (chunks.length === 0) return 0;
        const vectors = await embedDocuments(chunks.map((c) => ({ title: doc.title, text: c.text })));
        await saveChunkEmbeddings(
          data.userId,
          chunks.map((c, k) => ({ chunkId: c.id, embedding: vectors[k] })),
          model,
        );
        return chunks.length;
      });
      total += n;
      if (n < batch) break;
    }
    return { model, reembedded: total };
  },
);
