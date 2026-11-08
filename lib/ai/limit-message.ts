import "server-only";

import { RetryAfterError } from "inngest";

import { db } from "@/lib/db";
import { AiDailyLimitError } from "./gemini";
import { aiLimitMessage } from "./limit-reset";

export const AI_BUSY_MESSAGE = "The AI is busy right now. Try again in a moment.";

/** The daily-limit sentence with the reset time in this user's own time zone. */
export async function aiLimitMessageFor(userId: string): Promise<string> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { timeZone: true } }).catch(() => null);
  return aiLimitMessage(user?.timeZone);
}

/** Any AI error → what the user sees: daily limit (with reset time), busy, or `fallback`. */
export async function aiErrorMessage(err: unknown, userId: string, fallback: string): Promise<string> {
  if (err instanceof AiDailyLimitError || (err as Error)?.name === "AiDailyLimitError") return aiLimitMessageFor(userId);
  if (err instanceof RetryAfterError) return AI_BUSY_MESSAGE;
  return fallback;
}
