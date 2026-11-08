import "server-only";

import { Inngest } from "inngest";

/**
 * Inngest client. Locally the Inngest dev server (`npm run inngest`) runs the
 * jobs; in production INNGEST_EVENT_KEY sends events and INNGEST_SIGNING_KEY
 * verifies calls to /api/inngest.
 */
export const inngest = new Inngest({
  id: "vappi",
  // Inngest v4 defaults to cloud mode (needs signing/event keys) even under
  // `next dev`. Use the local dev server whenever Next runs in development,
  // unless INNGEST_DEV explicitly says otherwise (the SDK reads it then).
  isDev: process.env.INNGEST_DEV ? undefined : process.env.NODE_ENV === "development",
});

export const EVENTS = {
  documentUploaded: "document/uploaded",
  studyRegenerate: "document/regenerate",
  reembed: "document/reembed",
  reminderSend: "reminders/send",
  welcome: "email/welcome",
} as const;

export type DocumentUploadedData = { documentId: string; userId: string };

export type StudyRegenerateData = DocumentUploadedData & { part: "summary" | "flashcards" | "quiz" };

/** (Re)create one part of a document's study material. */
export async function sendStudyRegenerate(data: StudyRegenerateData) {
  await inngest.send({ name: EVENTS.studyRegenerate, data });
}

/**
 * Start (or restart) processing a document. `dedupeId` makes Inngest drop a
 * repeated send (e.g. completeUpload called twice) within 24 h.
 */
export async function sendDocumentUploaded(data: DocumentUploadedData, dedupeId: string) {
  await inngest.send({ id: dedupeId, name: EVENTS.documentUploaded, data });
}

/**
 * Queue the welcome email for a new account. Safe to call from both the Clerk
 * webhook and the first-visit path: the event id drops repeats within 24 h,
 * and the email itself is claimed once per account.
 */
export async function sendWelcomeEvent(userId: string) {
  await inngest.send({ id: `welcome-${userId}`, name: EVENTS.welcome, data: { userId } });
}
