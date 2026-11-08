import { currentWritingSpeed } from "@/lib/settings/writing-speed-server";
import { auth } from "@clerk/nextjs/server";

/**
 * GET /api/settings/writing-speed → { speed }: the signed-in user's own speed.
 * The editor checks it while Vappi is typing, so a change made on another
 * device or address applies without a reload.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "signed_out" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return Response.json({ speed: await currentWritingSpeed(userId) }, { headers: { "Cache-Control": "no-store" } });
}
