// Plain module: the viewer asks the owner-checked /file route for a 5-minute
// signed URL and fetches the file from storage directly (same-origin redirects
// to storage would arrive with `Origin: null`, which CORS refuses).

export async function signedFileUrl(route: string): Promise<string> {
  const res = await fetch(`${route}?signed=1`, { cache: "no-store" });
  if (!res.ok) throw new Error("file");
  const { url } = (await res.json()) as { url?: string };
  if (!url) throw new Error("file");
  return url;
}
