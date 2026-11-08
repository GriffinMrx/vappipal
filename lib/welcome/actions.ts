"use server";

import { getCurrentDbUser } from "@/lib/auth/current-user";
import { deliverWelcome } from "./deliver";

export type TestWelcomeResult = { ok: true; mode: "resend" | "preview" } | { ok: false; error: string };

/** Development only: send the welcome email to yourself now (marked [Test]; doesn't count). */
export async function sendTestWelcome(): Promise<TestWelcomeResult> {
  if (process.env.NODE_ENV === "production") return { ok: false, error: "Test emails are only available in development." };
  const user = await getCurrentDbUser();
  try {
    const res = await deliverWelcome(user.id, { test: true });
    if (res.status !== "sent" || res.result.mode === "disabled") return { ok: false, error: "Email is turned off." };
    return { ok: true, mode: res.result.mode };
  } catch {
    return { ok: false, error: "The email couldn't be sent. Check RESEND_API_KEY and EMAIL_FROM." };
  }
}
