"use server";

import { getCurrentDbUser } from "@/lib/auth/current-user";
import { hasProAccess } from "@/lib/billing/access";
import { db } from "@/lib/db";
import { rebuildPlanSafely } from "@/lib/planner/service";
import { sendDocumentUploaded, sendStudyRegenerate } from "@/lib/jobs/client";
import { checkLimit } from "@/lib/limits";
import { MAX_FILE_BYTES } from "@/lib/plans";
import { deleteObject, headObject, presignUpload, readHead } from "@/lib/storage";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { toDocumentView } from "./queries";
import {
  classifyFile,
  cleanTitle,
  signatureMatches,
  type CompleteUploadResult,
  type DeleteDocumentResult,
  type PrepareUploadResult,
  type RegenerateResult,
  type RetryDocumentResult,
} from "./types";

const PIPELINE_STEPS = ["EXTRACT", "EMBED", "SUMMARY", "FLASHCARDS", "QUIZ"] as const;

const START_FAILED = "Couldn't start processing. Try again.";

const id = z.string().trim().min(1).max(64);
const fileName = z.string().trim().min(1).max(255);

const formatMb = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

async function ownedSpace(userId: string, spaceId: string) {
  return db.space.findFirst({ where: { id: spaceId, userId }, select: { id: true } });
}

/** Key prefix that only this user's uploads to this space may use. */
const keyPrefix = (userId: string, spaceId: string) => `users/${userId}/${spaceId}/`;

/**
 * Step 1 of an upload: check everything, then hand the browser a short-lived
 * POST policy for ONE key, ONE content type and the plan's max size.
 */
export async function prepareUpload(input: {
  spaceId: string;
  fileName: string;
  size: number;
}): Promise<PrepareUploadResult> {
  const user = await getCurrentDbUser();
  const parsed = z
    .object({ spaceId: id, fileName, size: z.number().int().nonnegative() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "This file can't be uploaded." };
  const { spaceId, size } = parsed.data;

  if (!(await ownedSpace(user.id, spaceId))) return { ok: false, error: "Space not found." };

  const file = classifyFile(parsed.data.fileName);
  if (!file.ok) return { ok: false, error: file.reason };
  if (size === 0) return { ok: false, error: "This file is empty." };

  const limit = await checkLimit(user.id, "document");
  if (!limit.allowed) return { ok: false, limitReached: { limit: limit.limit ?? 0, used: limit.used } };

  const maxBytes = limit.pro ? MAX_FILE_BYTES.pro : MAX_FILE_BYTES.free;
  if (size > maxBytes) {
    return {
      ok: false,
      error: `This file is ${formatMb(size)}. Files can be up to ${formatMb(maxBytes)}${limit.pro ? "" : " on the Free plan"}.`,
    };
  }

  const key = `${keyPrefix(user.id, spaceId)}${randomUUID()}`;
  const { url, fields } = await presignUpload({ key, contentType: file.mime, maxBytes });
  return { ok: true, url, fields, key };
}

/**
 * Step 3 of an upload (after the browser POSTed the file): verify the stored
 * object really is the allowed file, then create the Document (Processing).
 * Any failed check deletes the object.
 */
export async function completeUpload(input: {
  spaceId: string;
  key: string;
  fileName: string;
}): Promise<CompleteUploadResult> {
  const user = await getCurrentDbUser();
  const parsed = z
    .object({ spaceId: id, key: z.string().min(1).max(300), fileName })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "This upload couldn't be finished." };
  const { spaceId, key } = parsed.data;

  // Only keys this user was allowed to write for this space. Never touch others.
  const prefix = keyPrefix(user.id, spaceId);
  if (!key.startsWith(prefix) || !/^[0-9a-f-]{36}$/.test(key.slice(prefix.length))) {
    return { ok: false, error: "This upload couldn't be finished." };
  }
  if (!(await ownedSpace(user.id, spaceId))) return { ok: false, error: "Space not found." };

  const reject = async (error: string): Promise<CompleteUploadResult> => {
    await deleteObject(key).catch(() => {});
    return { ok: false, error };
  };

  const file = classifyFile(parsed.data.fileName);
  if (!file.ok) return reject(file.reason);

  const stored = await headObject(key);
  if (!stored) return { ok: false, error: "The file didn't finish uploading. Try again." };

  const pro = await hasProAccess(user.id);
  const maxBytes = pro ? MAX_FILE_BYTES.pro : MAX_FILE_BYTES.free;
  if (stored.size === 0 || stored.size > maxBytes) return reject("This file is too big.");
  if (stored.contentType !== file.mime) return reject("This file type doesn't match its name.");
  if (!signatureMatches(file.type, file.mime, await readHead(key))) {
    return reject("This file looks damaged or isn't really a " + file.ext.toUpperCase() + " file.");
  }

  // Re-check the limit: two tabs could both have passed prepareUpload.
  const limit = await checkLimit(user.id, "document");
  if (!limit.allowed) {
    await deleteObject(key).catch(() => {});
    return { ok: false, limitReached: { limit: limit.limit ?? 0, used: limit.used } };
  }

  const existing = await db.document.findFirst({ where: { userId: user.id, fileKey: key } });
  const doc =
    existing ??
    (await db.document.create({
      data: {
        userId: user.id,
        spaceId,
        title: cleanTitle(parsed.data.fileName),
        fileKey: key,
        fileType: file.type,
        mimeType: file.mime,
        sizeBytes: stored.size,
        status: "PROCESSING",
        steps: { create: PIPELINE_STEPS.map((step) => ({ step })) },
      },
    }));

  // Start the background job (never inside this request, AGENTS.md §5).
  // If the job can't be started (e.g. Inngest unreachable), don't leave the
  // document stuck in Processing: mark it Failed so the user gets Retry.
  let started = true;
  try {
    await sendDocumentUploaded({ documentId: doc.id, userId: user.id }, `upload-${doc.id}`);
  } catch (err) {
    started = false;
    console.error("Could not start processing", err instanceof Error ? err.name : "error");
    await db.document.updateMany({
      where: { id: doc.id, userId: user.id, status: "PROCESSING", pagesProcessed: 0 },
      data: { status: "FAILED", failureReason: START_FAILED },
    });
  }

  revalidatePath("/", "layout");
  const view = started
    ? toDocumentView(doc)
    : toDocumentView({ ...doc, status: "FAILED", failureReason: START_FAILED });
  return { ok: true, document: view };
}

/** Delete a document (rows cascade) and its stored file. */
export async function deleteDocument(input: { documentId: string }): Promise<DeleteDocumentResult> {
  const user = await getCurrentDbUser();
  const parsed = z.object({ documentId: id }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Document not found." };

  const doc = await db.document.findFirst({
    where: { id: parsed.data.documentId, userId: user.id },
    select: { id: true, fileKey: true, spaceId: true },
  });
  if (!doc) return { ok: false, error: "Document not found." };

  await db.document.delete({ where: { id: doc.id } });
  await rebuildPlanSafely(user.id, doc.spaceId); // the plan drops its reading task
  // The row is gone either way; a storage hiccup only leaves a private orphan.
  await deleteObject(doc.fileKey).catch(() => {});

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Re-run processing for a FAILED document from a clean state. Not optimistic. */
export async function retryDocument(input: { documentId: string }): Promise<RetryDocumentResult> {
  const user = await getCurrentDbUser();
  const parsed = z.object({ documentId: id }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Document not found." };

  const doc = await db.document.findFirst({
    where: { id: parsed.data.documentId, userId: user.id },
    select: { id: true, status: true },
  });
  if (!doc) return { ok: false, error: "Document not found." };
  if (doc.status !== "FAILED") return { ok: false, error: "This document isn't in a failed state." };

  // Only flip FAILED → PROCESSING once, even if Retry is clicked twice.
  const reset = await db.$transaction(async (tx) => {
    const flipped = await tx.document.updateMany({
      where: { id: doc.id, userId: user.id, status: "FAILED" },
      data: { status: "PROCESSING", failureReason: null, pagesProcessed: 0, ocrUsed: false },
    });
    if (flipped.count === 0) return false;
    await tx.chunk.deleteMany({ where: { documentId: doc.id } });
    await tx.documentStep.updateMany({
      where: { documentId: doc.id },
      data: { status: "PENDING", error: null },
    });
    return true;
  });
  if (!reset) return { ok: false, error: "This document is already being processed." };

  try {
    await sendDocumentUploaded({ documentId: doc.id, userId: user.id }, `retry-${doc.id}-${Date.now()}`);
  } catch {
    await db.document.update({
      where: { id: doc.id },
      data: { status: "FAILED", failureReason: START_FAILED },
    });
    return { ok: false, error: START_FAILED };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

const PARTS = ["summary", "flashcards", "quiz"] as const;
const PART_STEP = { summary: "SUMMARY", flashcards: "FLASHCARDS", quiz: "QUIZ" } as const;

/**
 * Create / retry / regenerate study material for a Ready document, only when
 * the user asks (AGENTS.md §7). `part: "all"` is for documents that were
 * Ready before study material existed. Not optimistic: shows real progress.
 */
export async function regenerateStudyMaterial(input: {
  documentId: string;
  part: "summary" | "flashcards" | "quiz" | "all";
}): Promise<RegenerateResult> {
  const user = await getCurrentDbUser();
  const parsed = z
    .object({ documentId: id, part: z.enum(["summary", "flashcards", "quiz", "all"]) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Document not found." };

  const doc = await db.document.findFirst({
    where: { id: parsed.data.documentId, userId: user.id },
    select: { id: true, status: true },
  });
  if (!doc) return { ok: false, error: "Document not found." };
  if (doc.status !== "READY") return { ok: false, error: "This document isn't ready yet." };

  const parts = parsed.data.part === "all" ? PARTS : [parsed.data.part];
  let started = 0;
  for (const part of parts) {
    // Claim the step (refuse if it's already running), then start the job.
    const claimed = await db.documentStep.updateMany({
      where: { documentId: doc.id, step: PART_STEP[part], status: { not: "RUNNING" } },
      data: { status: "RUNNING", error: null },
    });
    if (claimed.count === 0) continue;
    try {
      await sendStudyRegenerate({ documentId: doc.id, userId: user.id, part });
      started++;
    } catch {
      await db.documentStep.updateMany({
        where: { documentId: doc.id, step: PART_STEP[part] },
        data: { status: "FAILED", error: START_FAILED },
      });
    }
  }

  revalidatePath("/", "layout");
  if (started === 0) return { ok: false, error: "This is already being created, or couldn't start. Try again." };
  return { ok: true };
}
