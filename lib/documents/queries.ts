import "server-only";

import { showStoredMessage } from "@/lib/ai/limit-reset";
import { db } from "@/lib/db";
import { checkLimit } from "@/lib/limits";
import { MAX_FILE_BYTES } from "@/lib/plans";
import type { StepStatus } from "@/lib/generated/prisma/enums";
import type { DocumentView, StudyPartView } from "./types";

const documentSelect = {
  id: true,
  title: true,
  fileType: true,
  status: true,
  sizeBytes: true,
  pageCount: true,
  pagesProcessed: true,
  ocrUsed: true,
  failureReason: true,
  createdAt: true,
  updatedAt: true,
  steps: { select: { step: true, status: true, error: true, updatedAt: true } },
  summary: { select: { id: true } },
  _count: { select: { flashcards: true, questions: true } },
} as const;

export function toDocumentView(d: {
  id: string;
  title: string;
  fileType: DocumentView["fileType"];
  status: DocumentView["status"];
  sizeBytes: number;
  pageCount: number | null;
  pagesProcessed: number;
  ocrUsed: boolean;
  failureReason: string | null;
  createdAt: Date;
  updatedAt?: Date;
  steps?: { step: string; status: StepStatus; error: string | null; updatedAt?: Date }[];
  summary?: { id: string } | null;
  _count?: { flashcards: number; questions: number };
}, timeZone?: string): DocumentView {
  const { steps = [], summary, _count, updatedAt, ...rest } = d;
  // The stored daily-limit marker → the sentence with the reset time in the user's zone.
  const now = new Date();
  const shown = (message: string | null, at?: Date) => showStoredMessage(message, timeZone, at, now);
  const order = ["EXTRACT", "EMBED", "SUMMARY", "FLASHCARDS", "QUIZ"];
  const running = steps
    .filter((s) => s.status === "RUNNING")
    .sort((a, b) => order.indexOf(a.step) - order.indexOf(b.step))[0]?.step;
  const part = (step: string, count: number): StudyPartView => {
    const s = steps.find((x) => x.step === step);
    return { status: s?.status ?? "PENDING", message: shown(s?.error ?? null, s?.updatedAt), count };
  };
  return {
    ...rest,
    failureReason: shown(d.failureReason, updatedAt),
    stage: (running as DocumentView["stage"]) ?? null,
    study: {
      summary: part("SUMMARY", summary ? 1 : 0),
      flashcards: part("FLASHCARDS", _count?.flashcards ?? 0),
      quiz: part("QUIZ", _count?.questions ?? 0),
    },
    createdAt: d.createdAt.toISOString(),
  };
}

/** A space's documents, newest first. Always scoped by userId. */
export async function listDocuments(userId: string, spaceId: string, timeZone?: string): Promise<DocumentView[]> {
  const rows = await db.document.findMany({
    where: { userId, spaceId },
    orderBy: { createdAt: "desc" },
    select: documentSelect,
  });
  return rows.map((r) => toDocumentView(r, timeZone));
}

/** What the upload UI needs to know up front (limits are enforced again on the server). */
export async function getUploadAllowance(userId: string) {
  const check = await checkLimit(userId, "document", { adding: 1 });
  return {
    maxBytes: check.pro ? MAX_FILE_BYTES.pro : MAX_FILE_BYTES.free,
    pro: check.pro,
    limit: check.limit,
    used: check.used,
  };
}

export type UploadAllowance = Awaited<ReturnType<typeof getUploadAllowance>>;
