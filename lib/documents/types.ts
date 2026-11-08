import type { DocumentStatus, FileType } from "@/lib/generated/prisma/enums";

/** Accepted uploads: extension → MIME type and stored FileType. */
export const ALLOWED_FILES = {
  pdf: { mime: "application/pdf", type: "PDF" },
  pptx: {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    type: "PPTX",
  },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    type: "DOCX",
  },
  jpg: { mime: "image/jpeg", type: "IMAGE" },
  jpeg: { mime: "image/jpeg", type: "IMAGE" },
  png: { mime: "image/png", type: "IMAGE" },
  webp: { mime: "image/webp", type: "IMAGE" },
} as const satisfies Record<string, { mime: string; type: FileType }>;

export type AllowedExtension = keyof typeof ALLOWED_FILES;

/** `accept` attribute for the file input. */
export const ACCEPT_ATTR = [
  ...Object.keys(ALLOWED_FILES).map((e) => `.${e}`),
  ...new Set(Object.values(ALLOWED_FILES).map((f) => f.mime)),
].join(",");

/** Known formats we refuse, with a fix the user can do. */
const REFUSED_HINTS: Record<string, string> = {
  doc: "Old Word files (.doc) aren't supported. Save it as .docx and upload again.",
  ppt: "Old PowerPoint files (.ppt) aren't supported. Save it as .pptx and upload again.",
  heic: "HEIC photos aren't supported. Export the photo as JPEG and upload again.",
  heif: "HEIF photos aren't supported. Export the photo as JPEG and upload again.",
};

export function extensionOf(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

/** Allowed file info, or a user-facing reason why not. */
export function classifyFile(
  fileName: string,
): { ok: true; ext: AllowedExtension; mime: string; type: FileType } | { ok: false; reason: string } {
  const ext = extensionOf(fileName);
  if (ext in ALLOWED_FILES) {
    const f = ALLOWED_FILES[ext as AllowedExtension];
    return { ok: true, ext: ext as AllowedExtension, mime: f.mime, type: f.type };
  }
  return {
    ok: false,
    reason: REFUSED_HINTS[ext] ?? "Upload a PDF, PowerPoint (.pptx), Word (.docx) or photo (JPEG, PNG, WEBP).",
  };
}

/** Does the file start with the bytes its type should have? (Rejects renamed files.) */
export function signatureMatches(type: FileType, mime: string, head: Uint8Array): boolean {
  const starts = (...bytes: number[]) => bytes.every((b, i) => head[i] === b);
  switch (type) {
    case "PDF":
      return starts(0x25, 0x50, 0x44, 0x46); // %PDF
    case "PPTX":
    case "DOCX":
      return starts(0x50, 0x4b, 0x03, 0x04); // PK zip
    case "IMAGE":
      if (mime === "image/jpeg") return starts(0xff, 0xd8, 0xff);
      if (mime === "image/png") return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
      if (mime === "image/webp") {
        const tag = String.fromCharCode(...head.slice(8, 12));
        return starts(0x52, 0x49, 0x46, 0x46) && tag === "WEBP"; // RIFF....WEBP
      }
      return false;
  }
}

/** Clean, display-safe title from a file name (control chars removed, max 200). */
export function cleanTitle(fileName: string) {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (clean || "Untitled").slice(0, 200);
}

/** Document as sent to the client. */
export type DocumentView = {
  id: string;
  title: string;
  fileType: FileType;
  status: DocumentStatus;
  sizeBytes: number;
  pageCount: number | null;
  pagesProcessed: number;
  ocrUsed: boolean;
  /** Which pipeline stage is running while PROCESSING (null = not started). */
  stage: "EXTRACT" | "EMBED" | "SUMMARY" | "FLASHCARDS" | "QUIZ" | null;
  study: Record<StudyPartName, StudyPartView>;
  failureReason: string | null;
  createdAt: string; // ISO
  /** True while an optimistic action is in flight. */
  pending?: boolean;
};

export type PrepareUploadResult =
  | { ok: true; url: string; fields: Record<string, string>; key: string }
  | { ok: false; error: string }
  | { ok: false; limitReached: { limit: number; used: number } };

export type CompleteUploadResult =
  | { ok: true; document: DocumentView }
  | { ok: false; error: string }
  | { ok: false; limitReached: { limit: number; used: number } };

export type DeleteDocumentResult = { ok: true } | { ok: false; error: string };

export type RetryDocumentResult = { ok: true } | { ok: false; error: string };

export type RegenerateResult = { ok: true } | { ok: false; error: string };

export type StudyPartName = "summary" | "flashcards" | "quiz";

/** Notes on a finished part (stored in DocumentStep.error with status DONE). */
export const NOTE_NOT_ENOUGH_TEXT = "Not enough text to make learning material from this file.";
export const NOTE_CARD_LIMIT = "Flashcard limit reached on the Free plan.";

/** State of one part of a document's study material. */
export type StudyPartView = {
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  /** Failure reason (FAILED) or a note on a finished part (DONE), e.g. the free card cap. */
  message: string | null;
  /** Items saved: 1/0 for the summary, cards, questions. */
  count: number;
};
