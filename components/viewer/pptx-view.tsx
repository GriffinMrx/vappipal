"use client";

import { useEffect, useRef, useState } from "react";
import { PageSkeleton } from "./skeleton";
import { signedFileUrl } from "./signed-url";
import type { ViewProps } from "./types";

const BASE = 960;

/**
 * PowerPoint slides drawn in the browser by pptx-preview, one under another
 * (slide N = Vappi's page N). Drawn at 960px wide in the deck's own shape,
 * then fitted to the box with CSS zoom. Close to the original, not pixel-exact:
 * "Download original" is always in the toolbar.
 */
export function PptxView({ url, onTotal, onReady, onError }: ViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const deck = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const cb = useRef({ onTotal, onReady, onError });
  useEffect(() => {
    cb.current = { onTotal, onReady, onError };
  });

  useEffect(() => {
    let cancelled = false;
    let previewer: { destroy: () => void } | null = null;
    (async () => {
      try {
        const res = await fetch(await signedFileUrl(url));
        if (!res.ok) throw new Error("fetch");
        const buf = await res.arrayBuffer();
        const { init } = await import("pptx-preview");
        const el = deck.current;
        if (cancelled || !el) return;
        el.replaceChildren();
        const p = init(el, { width: BASE, mode: "list" });
        previewer = p;
        await p.preview(buf);
        if (cancelled) return;
        const slides = el.querySelectorAll<HTMLElement>(".pptx-preview-slide-wrapper");
        slides.forEach((s, i) => s.setAttribute("data-vpage", String(i + 1)));
        if (slides.length === 0) throw new Error("empty");
        setLoaded(true);
        cb.current.onTotal(slides.length);
        cb.current.onReady();
      } catch {
        if (!cancelled) cb.current.onError();
      }
    })();
    return () => {
      cancelled = true;
      try {
        previewer?.destroy();
      } catch {}
    };
  }, [url]);

  useEffect(() => {
    const h = host.current;
    if (!h) return;
    const ro = new ResizeObserver(() => setScale(h.clientWidth / BASE));
    ro.observe(h);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={host} className="w-full">
      {!loaded && <PageSkeleton className="aspect-video" />}
      <div ref={deck} className="vappi-pptx" style={{ zoom: scale, width: BASE }} />
    </div>
  );
}
