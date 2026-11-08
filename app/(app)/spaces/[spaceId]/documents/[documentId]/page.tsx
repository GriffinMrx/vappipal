import { ChatPanelLayout } from "@/components/chat/chat-panel";
import { SpaceChatSlot } from "@/components/chat/space-chat-slot";
import { DocumentViewer } from "@/components/viewer/document-viewer";
import { getCurrentDbUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { pagesFromChunks } from "@/lib/documents/page-text";
import { fileHref } from "@/lib/documents/viewer";
import { getSpace } from "@/lib/spaces/queries";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = { title: "File · Vappi" };

/** Read a file inside Vappi, opened at `?page=N` (PDF page, Word page, slide). Owner only. */
export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ spaceId: string; documentId: string }>;
  searchParams: SearchParams;
}) {
  const [{ spaceId, documentId }, sp] = await Promise.all([params, searchParams]);
  const user = await getCurrentDbUser();
  const space = await getSpace(user.id, spaceId);
  if (!space) notFound();
  const doc = await db.document.findFirst({
    where: { id: documentId, spaceId: space.id, userId: user.id },
    select: { id: true, title: true, fileType: true, pageCount: true },
  });
  if (!doc) notFound();
  // Word / PowerPoint: if the original can't be drawn in the browser, show the text Vappi read.
  const fallbackPages =
    doc.fileType === "DOCX" || doc.fileType === "PPTX"
      ? pagesFromChunks(
          await db.chunk.findMany({
            where: { documentId: doc.id, userId: user.id },
            orderBy: { index: "asc" },
            select: { page: true, index: true, text: true },
          }),
        )
      : [];
  const raw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Math.min(Number.parseInt(raw ?? "1", 10) || 1, doc.pageCount ?? 100_000));

  return (
    <ChatPanelLayout chat={<SpaceChatSlot userId={user.id} spaceId={space.id} spaceName={space.name} />}>
      <DocumentViewer
        spaceId={space.id}
        spaceName={space.name}
        title={doc.title}
        fileType={doc.fileType}
        pageCount={doc.pageCount}
        fileUrl={fileHref(space.id, doc.id)}
        initialPage={page}
        fallbackPages={fallbackPages}
      />
    </ChatPanelLayout>
  );
}
