import "server-only";

import { currentEmbeddingModel, embedDocuments, embedPacing } from "@/lib/ai/embeddings";
import { AI_DAILY_LIMIT_MESSAGE } from "@/lib/ai/gemini";
import { hasProAccess } from "@/lib/billing/access";
import { db } from "@/lib/db";
import { rebuildPlanSafely } from "@/lib/planner/service";
import { ExtractError, openDocument, withOcr } from "@/lib/extract";
import { chunkPages } from "@/lib/extract/chunk";
import type { DocumentStepKind } from "@/lib/generated/prisma/enums";
import { MAX_PAGES } from "@/lib/plans";
import { chunksWithoutEmbedding, saveChunkEmbeddings } from "@/lib/search/vector";
import { readObject } from "@/lib/storage";
import { NonRetriableError } from "inngest";
import { EVENTS, inngest, type DocumentUploadedData } from "./client";
import { runPart } from "./study-material";

/** Pages read per job step (AGENTS.md §9: large files in batches). */
export const PAGE_BATCH = 20;
/** Chunk.index = page * this + position, stable across retries. */
const INDEX_STRIDE = 1000;

const GENERIC_FAILURE = "Something went wrong while reading this file. Try again.";

/** Thrown for problems the user should see as-is; never retried. */
class UserFacingError extends NonRetriableError {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

async function setStep(documentId: string, step: DocumentStepKind, status: "RUNNING" | "DONE") {
  await db.documentStep.updateMany({
    where: { documentId, step },
    data: { status, error: null, ...(status === "RUNNING" ? { attempts: { increment: 1 } } : {}) },
  });
}

/** The document, scoped by BOTH id and owner from the event. Stops the run if it's gone. */
async function ownedDocument({ documentId, userId }: DocumentUploadedData) {
  const doc = await db.document.findFirst({
    where: { id: documentId, userId },
    select: {
      id: true,
      userId: true,
      spaceId: true,
      fileKey: true,
      fileType: true,
      mimeType: true,
      title: true,
      status: true,
    },
  });
  if (!doc) throw new NonRetriableError("Document no longer exists");
  return doc;
}

async function loadFile(fileKey: string) {
  try {
    return await readObject(fileKey);
  } catch {
    throw new Error("Could not read the stored file"); // retried
  }
}

function toUserError(err: unknown): never {
  if (err instanceof ExtractError) throw new UserFacingError(err.message);
  throw err;
}

/**
 * File → pages → chunks (with page numbers) → embeddings → Ready.
 * Each stage is its own step, so a failure never redoes finished work, and
 * chunk writes are idempotent on (documentId, index).
 */
export const processDocument = inngest.createFunction(
  {
    id: "process-document",
    triggers: [{ event: EVENTS.documentUploaded }],
    // 4: Gemini free-tier rate limits (429 → wait and retry) also use attempts.
    retries: 4,
    concurrency: [{ key: "event.data.userId", limit: 2 }, { limit: 10 }],
    // Gemini free tier has low per-minute limits: start at most 10 runs a minute.
    throttle: { limit: 10, period: "1m" },
    singleton: { key: "event.data.documentId", mode: "skip" },
    onFailure: async ({ event, error }) => {
      const data = event.data.event.data as DocumentUploadedData;
      const reason =
        error.name === "UserFacingError" ? error.message : error.name === "AiDailyLimitError" ? AI_DAILY_LIMIT_MESSAGE : GENERIC_FAILURE;
      await db.$transaction([
        db.documentStep.updateMany({
          where: { documentId: data.documentId, status: "RUNNING" },
          data: { status: "FAILED", error: reason },
        }),
        db.document.updateMany({
          where: { id: data.documentId, userId: data.userId },
          data: { status: "FAILED", failureReason: reason },
        }),
      ]);
    },
  },
  async ({ event, step, attempt, maxAttempts }) => {
    const data = event.data as DocumentUploadedData;
    const finalAttempt = attempt + 1 >= (maxAttempts ?? 3);

    // 1. Open the file, count pages, enforce the plan's page cap.
    const info = await step.run("inspect", async () => {
      const doc = await ownedDocument(data);
      if (doc.status !== "PROCESSING") return null; // already handled (e.g. duplicate event)
      await setStep(doc.id, "EXTRACT", "RUNNING");
      const bytes = await loadFile(doc.fileKey);
      const extractor = await openDocument(bytes, doc.fileType, doc.mimeType).catch(toUserError);
      const pro = await hasProAccess(doc.userId);
      const maxPages = pro ? MAX_PAGES.pro : MAX_PAGES.free;
      await db.document.update({ where: { id: doc.id }, data: { pageCount: extractor.pageCount } });
      if (extractor.pageCount > maxPages) {
        const unit = doc.fileType === "PPTX" ? "slides" : "pages";
        throw new UserFacingError(
          `This file has ${extractor.pageCount} ${unit}. ${pro ? "Vappi" : "The Free plan"} reads up to ${maxPages} ${unit} per file.`,
        );
      }
      return { pageCount: extractor.pageCount };
    });
    if (!info) return { skipped: true };

    // 2. Read pages in batches; each batch saves its chunks (idempotent).
    for (let from = 1; from <= info.pageCount; from += PAGE_BATCH) {
      const to = Math.min(from + PAGE_BATCH - 1, info.pageCount);
      await step.run(`extract-pages-${from}-${to}`, async () => {
        const doc = await ownedDocument(data);
        const bytes = await loadFile(doc.fileKey);
        const extractor = await openDocument(bytes, doc.fileType, doc.mimeType).catch(toUserError);
        const raw = await extractor.pages(from, to).catch(toUserError);
        const { pages, ocrUsed } = await withOcr(raw, extractor);

        const perPage = new Map<number, number>();
        const rows = chunkPages(pages).map((c) => {
          const n = perPage.get(c.page) ?? 0;
          perPage.set(c.page, n + 1);
          return {
            documentId: doc.id,
            userId: doc.userId,
            spaceId: doc.spaceId,
            page: c.page,
            index: c.page * INDEX_STRIDE + Math.min(n, INDEX_STRIDE - 1),
            text: c.text,
          };
        });
        await db.chunk.createMany({ data: rows, skipDuplicates: true });
        await db.document.update({
          where: { id: doc.id },
          data: { pagesProcessed: to, ...(ocrUsed ? { ocrUsed: true } : {}) },
        });
        return { chunks: rows.length };
      });
    }

    const total = await step.run("count-chunks", async () => {
      const count = await db.chunk.count({ where: { documentId: data.documentId, userId: data.userId } });
      if (count === 0) throw new UserFacingError("No text was found in this file.");
      await setStep(data.documentId, "EXTRACT", "DONE");
      await setStep(data.documentId, "EMBED", "RUNNING");
      return count;
    });

    // 3. Embed chunks in batches until none are left.
    const pacing = embedPacing();
    for (let i = 0; i * pacing.batch < total + pacing.batch; i++) {
      // Stay under the provider's per-minute limit between batches.
      if (i > 0 && pacing.pause) await step.sleep(`embed-pause-${i}`, pacing.pause);
      const done = await step.run(`embed-${i}`, async () => {
        const doc = await ownedDocument(data);
        const model = currentEmbeddingModel();
        const chunks = await chunksWithoutEmbedding(data.documentId, data.userId, pacing.batch, model);
        if (chunks.length === 0) return true;
        const vectors = await embedDocuments(chunks.map((c) => ({ title: doc.title, text: c.text })));
        await saveChunkEmbeddings(
          data.userId,
          chunks.map((c, k) => ({ chunkId: c.id, embedding: vectors[k] })),
          model,
        );
        return chunks.length < pacing.batch;
      });
      if (done) break;
    }

    await step.run("embedded", async () => {
      await ownedDocument(data);
      await setStep(data.documentId, "EMBED", "DONE");
    });

    // 4. Study material: each part is its own step; a failure marks only that
    //    part as failed (shown with its own Retry), never the whole document.
    for (const part of ["summary", "flashcards", "quiz"] as const) {
      await step.run(`study-${part}`, () => runPart(data, part, { finalAttempt }));
    }

    // 5. Ready.
    await step.run("finish", async () => {
      await ownedDocument(data);
      await db.document.updateMany({
        where: { id: data.documentId, userId: data.userId },
        data: { status: "READY", failureReason: null },
      });
    });

    // The new document (and its flashcards) join the goal plan.
    await step.run("update-plan", async () => {
      const doc = await ownedDocument(data);
      await rebuildPlanSafely(data.userId, doc.spaceId);
    });

    return { pages: info.pageCount, chunks: total };
  },
);
