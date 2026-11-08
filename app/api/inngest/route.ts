import { inngest } from "@/lib/jobs/client";
import { processDocument } from "@/lib/jobs/process-document";
import { reembedDocument } from "@/lib/jobs/reembed";
import { regenerateStudyMaterial } from "@/lib/jobs/regenerate";
import { scanReminders, sendReminder } from "@/lib/jobs/reminders";
import { sendWelcome } from "@/lib/jobs/welcome";
import { serve } from "inngest/next";

// Inngest calls this route to run job steps. In production every call is
// verified with INNGEST_SIGNING_KEY (AGENTS.md §12).
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processDocument, regenerateStudyMaterial, reembedDocument, scanReminders, sendReminder, sendWelcome],
});

// Each step is one invocation; allow time for big page batches.
export const maxDuration = 300;
