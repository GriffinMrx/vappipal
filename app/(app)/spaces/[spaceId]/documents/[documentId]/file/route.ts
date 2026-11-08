import { db } from "@/lib/db";
import { presignGet } from "@/lib/storage";
import { auth } from "@clerk/nextjs/server";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Opens a user's own file through a 5-minute signed URL. Never a public
 * link. Other users' (or missing) documents get 404 so nothing is revealed.
 * - Default: 302 to the signed URL ("Download original").
 * - `?signed=1`: `{ url }` as JSON, for the in-app viewer. It fetches the
 *   signed URL itself: after a cross-site redirect the browser sends
 *   `Origin: null`, which the bucket's CORS rules (rightly) refuse.
 */
export async function GET(req: Request, { params }: { params: Promise<{ spaceId: string; documentId: string }> }) {
  const { userId } = await auth();
  if (!userId) return new Response("Not found", { status: 404, headers: NO_STORE });

  const { spaceId, documentId } = await params;
  const doc = await db.document.findFirst({
    where: { id: documentId, spaceId, userId },
    select: { fileKey: true, title: true, mimeType: true },
  });
  if (!doc) return new Response("Not found", { status: 404, headers: NO_STORE });

  const url = await presignGet(doc.fileKey, doc.title, doc.mimeType);
  if (new URL(req.url).searchParams.get("signed") === "1") {
    return Response.json({ url }, { headers: { ...NO_STORE, "Referrer-Policy": "no-referrer" } });
  }
  return new Response(null, {
    status: 302,
    headers: { Location: url, ...NO_STORE, "Referrer-Policy": "no-referrer" },
  });
}
