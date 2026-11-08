import "server-only";

import { firstName } from "@/lib/user/name";
import { db } from "@/lib/db";
import { renderWelcome } from "@/lib/email/welcome-template";
import { sendEmail, type SendResult } from "@/lib/email/send";
import { appUrl } from "@/lib/app-url";

export type WelcomeResult = { status: "sent"; result: SendResult } | { status: "already-sent" | "missing" };

/**
 * Send the welcome email once per account. The row is claimed atomically
 * (welcomeEmailAt null → now), so the webhook and the first-visit path can
 * both ask and only one sends; Resend's idempotency key covers job retries.
 * If sending fails, the claim is released so the job's retry can send it.
 * `test` sends now (marked [Test]) and doesn't touch the claim.
 */
export async function deliverWelcome(userId: string, opts: { test?: boolean } = {}): Promise<WelcomeResult> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } });
  if (!user) return { status: "missing" };
  if (!opts.test) {
    const claimed = await db.user.updateMany({ where: { id: userId, welcomeEmailAt: null }, data: { welcomeEmailAt: new Date() } });
    if (claimed.count === 0) return { status: "already-sent" };
  }
  const base = appUrl();
  const { subject, html, text } = renderWelcome(firstName(user), { start: `${base}/spaces`, settings: `${base}/settings` });
  try {
    const result = await sendEmail({
      to: user.email,
      subject: opts.test ? `[Test] ${subject}` : subject,
      html,
      text,
      idempotencyKey: opts.test ? `welcome-test/${user.id}/${Date.now()}` : `welcome/${user.id}`,
      previewName: `welcome-${opts.test ? "test-" : ""}${user.id}`,
    });
    return { status: "sent", result };
  } catch (err) {
    if (!opts.test) await db.user.updateMany({ where: { id: userId }, data: { welcomeEmailAt: null } });
    throw err;
  }
}
