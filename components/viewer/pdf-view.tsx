"use client";

import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";
import { signedFileUrl } from "./signed-url";
import type { ViewProps } from "./types";

type PdfJs = typeof import("pdfjs-dist");

/**
 * PDF pages drawn with pdf.js: a canvas per page plus an invisible text layer,
 * so text can be selected and copied. Pages draw when they come near the
 * screen (placeholders keep their size, so jumping to page N works at once).
 */
export function PdfView({ url, zoom, onTotal, onReady, onError }: ViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<{ lib: PdfJs; doc: PDFDocumentProxy; ratio: number } | null>(null);
  const [width, setWidth] = useState(0);
  const cb = useRef({ onTotal, onReady, onError });
  useEffect(() => {
    cb.current = { onTotal, onReady, onError };
  });

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | null = null;
    (async () => {
      try {
        const lib = await import("pdfjs-dist");
        lib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        // One plain GET of the signed file (no range requests across the redirect).
        const signed = await signedFileUrl(url);
        if (cancelled) return;
        const task = lib.getDocument({ url: signed, disableRange: true, disableStream: true });
        destroy = () => void task.destroy();
        const doc = await task.promise;
        if (cancelled) return;
        const first = (await doc.getPage(1)).getViewport({ scale: 1 });
        setPdf({ lib, doc, ratio: first.height / first.width });
        cb.current.onTotal(doc.numPages);
      } catch {
        if (!cancelled) cb.current.onError();
      }
    })();
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [url]);

  // Page width follows the box (and the zoom the shell applies to it).
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (pdf && width > 0) cb.current.onReady();
  }, [pdf, width]);

  return (
    <div ref={host} className="flex flex-col gap-4" data-zoom={zoom}>
      {pdf &&
        width > 0 &&
        Array.from({ length: pdf.doc.numPages }, (_, i) => (
          <PdfPage key={i + 1} n={i + 1} lib={pdf.lib} doc={pdf.doc} width={width} ratio={pdf.ratio} />
        ))}
    </div>
  );
}

function PdfPage({ n, lib, doc, width, ratio }: { n: number; lib: PdfJs; doc: PDFDocumentProxy; width: number; ratio: number }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [height, setHeight] = useState(Math.round(width * ratio));

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: "1200px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    let layer: { cancel: () => void } | null = null;
    (async () => {
      const page = await doc.getPage(n);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const scale = width / base.width;
      const viewport = page.getViewport({ scale });
      setHeight(Math.round(viewport.height));
      const c = canvas.current;
      const t = text.current;
      if (!c || !t) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.floor(viewport.width * dpr);
      c.height = Math.floor(viewport.height * dpr);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      task = page.render({ canvas: c, canvasContext: ctx, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
      try {
        await task.promise;
      } catch {
        return; // cancelled by a newer render
      }
      if (cancelled) return;
      t.replaceChildren();
      t.style.setProperty("--total-scale-factor", String(scale));
      const tl = new lib.TextLayer({ textContentSource: page.streamTextContent(), container: t, viewport });
      layer = tl;
      await tl.render().catch(() => {});
    })();
    return () => {
      cancelled = true;
      task?.cancel();
      layer?.cancel();
    };
  }, [near, width, doc, lib, n]);

  return (
    <div
      ref={box}
      data-vpage={n}
      aria-label={`Page ${n}`}
      role="region"
      className="relative w-full overflow-hidden rounded-md bg-white shadow-[0_1px_3px_rgb(0_0_0/0.4)]"
      style={{ height }}
    >
      <canvas ref={canvas} className="block h-full w-full" />
      <div ref={text} className="textLayer" />
    </div>
  );
}
