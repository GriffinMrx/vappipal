import "server-only";

import { db } from "@/lib/db";

/** Turn reminders off for the owner of `token`. Only ever turns them OFF. */
export async function unsubscribeByToken(token: unknown): Promise<boolean> {
  if (typeof token !== "string" || token.length < 10 || token.length > 64) return false;
  const res = await db.user.updateMany({ where: { unsubscribeToken: token }, data: { emailReminders: false } });
  return res.count === 1;
}
