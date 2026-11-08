"use client";

import { useEffect, useRef, useState } from "react";
import { PageSkeleton } from "./skeleton";
import { signedFileUrl } from "./signed-url";
import type { ViewProps } from "./types";

/**
 * Word files drawn in the browser by docx-preview (fonts, headings, lists,
 * tables, images). It splits pages at the page breaks Word saved, the same
 * breaks Vappi uses for page numbers, so page N here is the cited page N.
 * Pages have Word's own width; CSS zoom fits them to the box.
 */
export function DocxView({ url, onTotal, onReady, onError }: ViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const doc = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const cb = useRef({ onTotal, onReady, onError });
  useEffect(() => {
    cb.current = { onTotal, onReady, onError };
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(await signedFileUrl(url));
        if (!res.ok) throw new Error("fetch");
        const blob = await res.blob();
        const { renderAsync } = await import("docx-preview");
        const el = doc.current;
        if (cancelled || !el) return;
        el.replaceChildren();
        await renderAsync(blob, el, el, {
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          renderHeaders: true,
          renderFooters: true,
          className: "docx",
        });
        if (cancelled) return;
        const pages = el.querySelectorAll<HTMLElement>("section.docx");
        pages.forEach((p, i) => p.setAttribute("data-vpage", String(i + 1)));
        setLoaded(true);
        cb.current.onTotal(pages.length);
      } catch {
        if (!cancelled) cb.current.onError();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  // Fit Word's page width to the box.
  useEffect(() => {
    const h = host.current;
    if (!h || !loaded) return;
    const fit = () => {
      const page = doc.current?.querySelector<HTMLElement>("section.docx");
      if (page) setScale(Math.min(2, h.clientWidth / page.offsetWidth));
    };
    const ro = new ResizeObserver(fit);
    ro.observe(h);
    fit();
    // Pages are at their final size now: the shell can jump to the cited one.
    const t = setTimeout(() => cb.current.onReady(), 50);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  }, [loaded]);

  return (
    <div ref={host} className="w-full">
      {!loaded && <PageSkeleton />}
      <div ref={doc} className="vappi-docx origin-top text-black" style={{ zoom: scale }} />
    </div>
  );
}
