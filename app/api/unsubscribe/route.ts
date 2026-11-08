import { unsubscribeByToken } from "@/lib/reminders/unsubscribe";

/**
 * One-click unsubscribe (RFC 8058): mail apps POST here from the
 * List-Unsubscribe header. Same neutral answer for good and bad tokens.
 */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  await unsubscribeByToken(token);
  return new Response("Daily reminders are off.", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
