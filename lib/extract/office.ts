import "server-only";

import { strFromU8, unzipSync } from "fflate";
import { ExtractError, type ExtractedPage, type Extractor } from "./types";

/**
 * Local, free text extraction for .pptx and .docx (they are zip files of XML).
 * Stands in for LlamaParse (PARSER=llamaparse later) behind the same interface.
 */

const MAX_ENTRY_BYTES = 30 * 1024 * 1024; // per XML part, guards against zip bombs
const WORDS_PER_PAGE = 500;

function unzip(bytes: Uint8Array, wanted: (name: string) => boolean): Record<string, string> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (f) => {
        if (!wanted(f.name)) return false;
        if (f.originalSize > MAX_ENTRY_BYTES) throw new ExtractError("This file is too large to read.");
        return true;
      },
    });
  } catch (err) {
    if (err instanceof ExtractError) throw err;
    throw new ExtractError("Couldn't read this file. It may be damaged. Save it again and re-upload.");
  }
  return Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strFromU8(v)]));
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function decode(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

/** DrawingML text: <a:t> runs, one line per <a:p> paragraph. */
function drawingText(xml: string): string {
  return xml
    .split(/<\/a:p>/)
    .map((p) => [...p.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((m) => decode(m[1])).join(""))
    .filter((line) => line.trim())
    .join("\n");
}

function relsMap(xml: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of (xml ?? "").matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
    const target = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
    if (id && target) map.set(id, target);
  }
  return map;
}

function resolvePath(baseDir: string, target: string) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = `${baseDir}/${target}`.split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p && p !== ".") out.push(p);
  }
  return out.join("/");
}

function fromPages(pages: ExtractedPage[]): Extractor {
  return {
    pageCount: pages.length,
    async pages(from, to) {
      return pages.slice(from - 1, to);
    },
  };
}

/** One page per slide, in presentation order, with speaker notes. */
export function pptxExtractor(bytes: Uint8Array): Extractor {
  const files = unzip(
    bytes,
    (n) =>
      n === "ppt/presentation.xml" ||
      n === "ppt/_rels/presentation.xml.rels" ||
      /^ppt\/slides\/(_rels\/)?slide\d+\.xml(\.rels)?$/.test(n) ||
      /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n),
  );
  const presentation = files["ppt/presentation.xml"];
  if (!presentation) throw new ExtractError("Couldn't read this PowerPoint file. Save it as .pptx and re-upload.");

  const rels = relsMap(files["ppt/_rels/presentation.xml.rels"]);
  let order = [...presentation.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)]
    .map((m) => rels.get(m[1]))
    .filter((t): t is string => !!t)
    .map((t) => resolvePath("ppt", t));
  if (order.length === 0) {
    order = Object.keys(files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)![1]) - Number(/(\d+)\.xml$/.exec(b)![1]));
  }

  const pages = order.map((path, i) => {
    const slide = drawingText(files[path] ?? "");
    const slideRels = relsMap(files[path.replace(/slides\/(slide\d+\.xml)$/, "slides/_rels/$1.rels")]);
    const notesTarget = [...slideRels.values()].find((t) => /notesSlide\d+\.xml$/.test(t));
    const notesXml = notesTarget ? files[resolvePath("ppt/slides", notesTarget)] : undefined;
    // Notes include the slide-number placeholder; keep only real text lines.
    const notes = notesXml
      ? drawingText(notesXml)
          .split("\n")
          .filter((l) => !/^\d+$/.test(l.trim()))
          .join("\n")
      : "";
    const text = notes.trim() ? `${slide}\n\nSpeaker notes:\n${notes}` : slide;
    return { page: i + 1, text };
  });
  if (pages.length === 0) throw new ExtractError("This presentation has no slides.");
  return fromPages(pages);
}

/**
 * Word has no fixed pages. Use the page breaks Word saved when it last laid
 * out the document (and explicit page breaks); otherwise ~500 words per page.
 */
export function docxExtractor(bytes: Uint8Array): Extractor {
  const xml = unzip(bytes, (n) => n === "word/document.xml")["word/document.xml"];
  if (!xml) throw new ExtractError("Couldn't read this Word file. Save it as .docx and re-upload.");
  const body = xml.slice(Math.max(0, xml.indexOf("<w:body")));

  const BREAK = "\u0000PAGE\u0000";
  const text = decode(
    body
      .replace(/<w:lastRenderedPageBreak\/>|<w:br\b[^>]*w:type="page"[^>]*\/>/g, BREAK)
      .replace(/<w:tab\/>/g, " ")
      .replace(/<w:br\b[^>]*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g, "$1")
      .replace(/<[^>]+>/g, ""),
  );

  let pieces = text.split(BREAK);
  if (pieces.length === 1) {
    const words = text.split(/(\s+)/);
    pieces = [];
    let current = "";
    let count = 0;
    for (const w of words) {
      current += w;
      if (w.trim() && ++count >= WORDS_PER_PAGE) {
        pieces.push(current);
        current = "";
        count = 0;
      }
    }
    if (current.trim()) pieces.push(current);
  }
  const pages = pieces.map((t) => t.trim()).filter(Boolean).map((t, i) => ({ page: i + 1, text: t }));
  if (pages.length === 0) throw new ExtractError("No text found in this Word file.");
  return fromPages(pages);
}
