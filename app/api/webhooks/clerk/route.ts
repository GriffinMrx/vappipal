import { db } from "@/lib/db";
import { sendWelcomeEvent } from "@/lib/jobs/client";
import { Prisma } from "@/lib/generated/prisma/client";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";

/**
 * Clerk → User sync (AGENTS.md §8). Verified with CLERK_WEBHOOK_SIGNING_SECRET
 * before any DB work; deduped on the svix-id so Clerk retries are no-ops.
 * Never logs email or name.
 */
export async function POST(req: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const eventId = req.headers.get("svix-id");
  if (!eventId) return new Response("Missing event id", { status: 400 });

  try {
    await db.webhookEvent.create({ data: { source: "CLERK", eventId } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return new Response("Already handled", { status: 200 });
    }
    throw err;
  }

  try {
    if (evt.type === "user.created" || evt.type === "user.updated") {
      const u = evt.data;
      const primary = u.email_addresses.find((e) => e.id === u.primary_email_address_id);
      const email = primary?.email_address ?? u.email_addresses[0]?.email_address;
      if (!email) return new Response("No email", { status: 200 });
      const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || null;
      await db.user.upsert({
        where: { id: u.id },
        create: { id: u.id, email, name },
        update: { email, name },
      });
      if (evt.type === "user.created") {
        // The email job retries on its own; a queue hiccup must not fail the sync
        // (the first visit queues it too).
        await sendWelcomeEvent(u.id).catch(() => console.error("Welcome email not queued"));
      }
    } else if (evt.type === "user.deleted" && evt.data.id) {
      // Cascades remove the user's spaces, documents, cards, attempts, etc.
      await db.user.deleteMany({ where: { id: evt.data.id } });
    }
  } catch (err) {
    // Let Clerk retry: forget this delivery so the retry is processed.
    await db.webhookEvent.deleteMany({ where: { source: "CLERK", eventId } });
    console.error("Clerk webhook failed", evt.type, err instanceof Error ? err.name : "error");
    return new Response("Error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
