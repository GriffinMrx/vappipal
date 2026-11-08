import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";

/**
 * Email sending (server-only; the Resend key never reaches the browser).
 * - RESEND_API_KEY set → real send from EMAIL_FROM.
 * - No key in development → "preview": the email is written to
 *   .email-previews/ (gitignored) and nothing is sent.
 * - No key in production → disabled (nothing sent).
 * Logs never contain addresses, names or content.
 */

export type EmailMode = "resend" | "preview" | "disabled";

export function emailMode(): EmailMode {
  if (process.env.RESEND_API_KEY) return "resend";
  return process.env.NODE_ENV === "production" ? "disabled" : "preview";
}

const globalForResend = globalThis as unknown as { resend?: Resend };
const client = () => (globalForResend.resend ??= new Resend(process.env.RESEND_API_KEY));

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  /** Same key = Resend sends it once (safe job retries). */
  idempotencyKey: string;
  /** File name stem for preview mode. */
  previewName: string;
};

export type SendResult = { sent: boolean; mode: EmailMode; previewPath?: string };

export async function sendEmail(email: OutgoingEmail): Promise<SendResult> {
  const mode = emailMode();
  if (mode === "disabled") return { sent: false, mode };

  if (mode === "preview") {
    const dir = path.join(process.cwd(), ".email-previews");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${email.previewName.replace(/[^\w.-]/g, "_")}.html`);
    await writeFile(file, email.html, "utf8");
    return { sent: true, mode, previewPath: file };
  }

  const { error } = await client().emails.send(
    {
      from: process.env.EMAIL_FROM || "Vappi <onboarding@resend.dev>",
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      headers: email.headers,
    },
    { idempotencyKey: email.idempotencyKey },
  );
  if (error) {
    console.error("Email send failed", error.name);
    throw Object.assign(new Error(`Resend: ${error.name}`), { status: (error as { statusCode?: number }).statusCode });
  }
  return { sent: true, mode };
}
