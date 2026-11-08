"use server";

import { getCurrentDbUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ClearChatResult = { ok: true } | { ok: false; error: string };

/**
 * Delete every chat message of one Space, for the signed-in user only.
 * Files, summaries, cards and the hourly chat limits are untouched.
 */
export async function clearChat(input: { spaceId: string }): Promise<ClearChatResult> {
  const user = await getCurrentDbUser();
  const parsed = z.object({ spaceId: z.string().min(1).max(64) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Space not found." };

  const space = await db.space.findFirst({ where: { id: parsed.data.spaceId, userId: user.id }, select: { id: true } });
  if (!space) return { ok: false, error: "Space not found." };

  await db.chatMessage.deleteMany({ where: { userId: user.id, spaceId: space.id } });
  revalidatePath(`/spaces/${space.id}`);
  return { ok: true };
}
