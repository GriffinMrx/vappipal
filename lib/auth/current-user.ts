import "server-only";

import { db } from "@/lib/db";
import { sendWelcomeEvent } from "@/lib/jobs/client";
import { auth, currentUser } from "@clerk/nextjs/server";
import { cache } from "react";

const userSelect = { id: true, email: true, name: true, timeZone: true, plan: true } as const;

/**
 * The signed-in user's database row. Redirects signed-out visitors to
 * sign-in. The Clerk webhook is the real creator of User rows; until it
 * exists (and as a safety net if a webhook is late) the row is upserted here
 * from the Clerk profile. Cached per request, so every island that needs the
 * user shares one query.
 */
export const getCurrentDbUser = cache(async () => {
  const { userId } = await auth.protect();

  const existing = await db.user.findUnique({ where: { id: userId }, select: userSelect });
  if (existing) return existing;

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress;
  if (!email) throw new Error("Signed-in user has no primary email");

  // A first visit renders several islands in parallel; each may get here.
  // `createMany … skipDuplicates` is one atomic INSERT … ON CONFLICT DO NOTHING,
  // so concurrent first loads can't fail on the primary key (upsert can).
  const created = await db.user.createMany({
    data: [
      {
        id: userId,
        email,
        name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null,
      },
    ],
    skipDuplicates: true,
  });
  // This visit created the account (the webhook hasn't yet): queue the welcome email.
  if (created.count === 1) await sendWelcomeEvent(userId).catch(() => console.error("Welcome email not queued"));
  return db.user.findUniqueOrThrow({ where: { id: userId }, select: userSelect });
});

/** First name for greetings (falls back to the email's local part). */
export { firstName } from "@/lib/user/name";
