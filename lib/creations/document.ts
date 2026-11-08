import "server-only";

import { MarkdownManager } from "@tiptap/markdown";
import { contentExtensions, creationSchema, SAFE_LINK } from "./extensions";
import { CONTENT_MAX } from "./types";

let manager: MarkdownManager | null = null;

type Json = { type?: string; marks?: { type: string; attrs?: { href?: unknown } }[]; content?: Json[] };

/** Drops link marks whose URL isn't http(s)/mailto (e.g. "javascript:"), recursively. */
function stripUnsafeLinks<T>(node: T): T {
  const n = node as Json;
  if (n?.marks) n.marks = n.marks.filter((m) => m.type !== "link" || SAFE_LINK.test(String(m.attrs?.href ?? "")));
  n?.content?.forEach(stripUnsafeLinks);
  return node;
}

/** The AI's Markdown → an editor document (same schema as the browser editor). */
export function markdownToDoc(markdown: string): unknown {
  manager ??= new MarkdownManager({ extensions: contentExtensions });
  return stripUnsafeLinks(manager.parse(markdown));
}

/**
 * Checks a document from the browser: valid against the editor schema and
 * under the size cap. Returns the normalised JSON, or null when invalid.
 * (Unknown nodes/attributes never reach the database.)
 */
export function validDoc(input: unknown): unknown | null {
  try {
    if (JSON.stringify(input).length > CONTENT_MAX) return null;
    // The schema's own model (a separate prosemirror-model copy would reject it).
    const node = creationSchema().nodeFromJSON(input);
    if (node.type.name !== "doc") return null;
    node.check();
    return stripUnsafeLinks(node.toJSON());
  } catch {
    return null;
  }
}
