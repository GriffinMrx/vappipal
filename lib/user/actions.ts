"use server";

import { getCurrentDbUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

function isValidTimeZone(tz: string) {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Store the browser's IANA time zone so "today" is the user's day
 * (AGENTS.md §10/§12). Only updates the caller's own row.
 */
export async function syncTimeZone(timeZone: string): Promise<{ ok: boolean }> {
  const user = await getCurrentDbUser();
  if (!isValidTimeZone(timeZone) || timeZone === user.timeZone) return { ok: false };
  await db.user.update({ where: { id: user.id }, data: { timeZone } });
  revalidatePath("/", "layout");
  return { ok: true };
}
