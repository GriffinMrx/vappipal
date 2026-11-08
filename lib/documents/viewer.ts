// Plain module (server and client): links into the in-app file viewer (prompt 38).

/** Open a file inside Vappi, at page/slide `page` when given. */
export function viewerHref(spaceId: string, documentId: string, page?: number | null) {
  return `/spaces/${spaceId}/documents/${documentId}${page && page > 0 ? `?page=${page}` : ""}`;
}

/** The original file (5-minute signed link, for "Download original"). */
export function fileHref(spaceId: string, documentId: string) {
  return `/spaces/${spaceId}/documents/${documentId}/file`;
}
