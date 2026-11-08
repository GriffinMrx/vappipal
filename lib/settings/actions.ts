"use server";

import { getCurrentDbUser } from "@/lib/auth/current-user";
import { hasProAccess } from "@/lib/billing/access";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { WRITING_SPEED_KEYS } from "./writing-speed";

/** Settings → how fast Vappi types in the Create editor (Pro). */
export async function setWritingSpeed(input: { speed: string }): Promise<{ ok: boolean }> {
  const user = await getCurrentDbUser();
  if (!(await hasProAccess(user.id))) return { ok: false }; // Pro setting
  const parsed = z.object({ speed: z.enum(WRITING_SPEED_KEYS as [string, ...string[]]) }).safeParse(input);
  if (!parsed.success) return { ok: false };
  await db.user.update({ where: { id: user.id }, data: { writingSpeed: parsed.data.speed as (typeof WRITING_SPEED_KEYS)[number] } });
  revalidatePath("/settings");
  return { ok: true };
}
