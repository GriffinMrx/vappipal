import "server-only";

import { hasProAccess } from "@/lib/billing/access";
import { db } from "@/lib/db";
import type { WritingSpeed } from "./writing-speed";

/**
 * The speed Vappi types at for this user right now, read fresh from the
 * database (the source of truth across devices and addresses).
 * The setting is Pro; everyone else gets Normal.
 */
export async function currentWritingSpeed(userId: string): Promise<WritingSpeed> {
  const [pro, user] = await Promise.all([
    hasProAccess(userId),
    db.user.findUnique({ where: { id: userId }, select: { writingSpeed: true } }),
  ]);
  return pro && user ? user.writingSpeed : "NORMAL";
}
