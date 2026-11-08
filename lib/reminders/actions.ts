"use server";

import { getCurrentDbUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { deliverReminder } from "./deliver";

/** Daily reminder on/off. Optimistic in the UI. */
export async function setEmailReminders(input: { on: boolean }): Promise<{ ok: boolean }> {
  const user = await getCurrentDbUser();
  const parsed = z.object({ on: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false };
  await db.user.update({ where: { id: user.id }, data: { emailReminders: parsed.data.on } });
  revalidatePath("/settings");
  return { ok: true };
}

export type TestReminderResult =
  | { ok: true; mode: "resend" | "preview"; previewPath?: string }
  | { ok: false; error: string };

/** Development only: send today's reminder now (doesn't count as today's). */
export async function sendTestReminder(): Promise<TestReminderResult> {
  if (process.env.NODE_ENV === "production") return { ok: false, error: "Test emails are only available in development." };
  const user = await getCurrentDbUser();
  try {
    const res = await deliverReminder(user.id, { test: true });
    if (res.status === "nothing-to-do") {
      return { ok: false, error: "Nothing to remind you about today: no cards due and no plan tasks." };
    }
    if (res.status !== "sent" || res.result.mode === "disabled") return { ok: false, error: "Email is turned off." };
    return { ok: true, mode: res.result.mode, previewPath: res.result.previewPath };
  } catch {
    return { ok: false, error: "The email couldn't be sent. Check RESEND_API_KEY and EMAIL_FROM." };
  }
}
