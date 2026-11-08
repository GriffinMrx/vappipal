"use client";

import { ChatToggleButton } from "@/components/chat/chat-panel";
import type { FileType } from "@/lib/generated/prisma/enums";
import { ChevronLeft, Download, Maximize, Minus, Plus } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { PageTextView } from "@/lib/documents/page-text";
import { PageSkeleton } from "./skeleton";
import type { ViewProps } from "./types";

// Each renderer (and its library) loads only when such a file is opened.
const loading = () => <PageSkeleton />;
const PdfView = dynamic(() => import("./pdf-view").then((m) => m.PdfView), { ssr: false, loading });
const DocxView = dynamic(() => import("./docx-view").then((m) => m.DocxView), { ssr: false, loading });
const PptxView = dynamic(() => import("./pptx-view").then((m) => m.PptxView), { ssr: false, loading });
const ImageView = dynamic(() => import("./image-view").then((m) => m.ImageView), { ssr: false, loading });

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const unit = (t: FileType) => (t === "PPTX" ? "Slide" : "Page");

/**
 * Read a file inside Vappi (prompt 38). The renderer marks each page with
 * `data-vpage="N"`; this shell owns the toolbar, the current page (kept in
 * the address), zoom, and jumping to a cited page with a short highlight.
 */
export function DocumentViewer({
  spaceId,
  spaceName,
  title,
  fileType,
  pageCount,
  fileUrl,
  initialPage,
  fallbackPages = [],
}: {
  spaceId: string;
  spaceName: string;
  title: string;
  fileType: FileType;
  pageCount: number | null;
  fileUrl: string;
  initialPage: number;
  /** Word / PowerPoint text per page, shown if the original can't be drawn. */
  fallbackPages?: PageTextView[];
}) {
  const [total, setTotal] = useState<number | null>(fileType === "IMAGE" ? 1 : pageCount);
  const [page, setPage] = useState(initialPage);
  const [zoom, setZoom] = useState(1);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // Couldn't draw the original, but we have the text Vappi read: show that instead.
  const reading = failed && fallbackPages.length > 0;
  const [jump, setJump] = useState({ page: initialPage, n: 0 });
  const [input, setInput] = useState(String(initialPage));
  const box = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const jumping = useRef(false);

  // A new ?page= (another citation clicked while this file is open) → go there.
  useEffect(() => {
    // Prop → jump request (the renderer scrolls once the page exists).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJump((j) => ({ page: initialPage, n: j.n + 1 }));
  }, [initialPage]);

  const goTo = useCallback((p: number) => setJump((j) => ({ page: p, n: j.n + 1 })), []);

  // Scroll to the requested page once it's rendered, and ring it for a moment.
  useEffect(() => {
    if (!ready) return;
    const el = box.current?.querySelector<HTMLElement>(`[data-vpage="${jump.page}"]`);
    if (!el) return;
    jumping.current = true;
    // Measured, not scrollIntoView: Word pages are CSS-zoomed, and both bars are sticky.
    const bars = (document.querySelector("header")?.offsetHeight ?? 0) + (toolbar.current?.offsetHeight ?? 0) + 12;
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - bars, behavior: jump.n <= 1 ? "auto" : "smooth" });
    el.classList.add("vpage-cited");
    const t1 = setTimeout(() => el.classList.remove("vpage-cited"), 1600);
    const t2 = setTimeout(() => (jumping.current = false), 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      el.classList.remove("vpage-cited");
    };
  }, [jump, ready]);

  // The page in view → toolbar + address (replaceState: Back leaves the viewer, refresh stays here).
  useEffect(() => {
    if (!ready) return;
    let raf = 0;
    const onScroll = () => {
      // The page a link asked for wins until the reader scrolls themselves.
      if (jumping.current) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const pages = box.current?.querySelectorAll<HTMLElement>("[data-vpage]");
        if (!pages?.length) return;
        const line = window.innerHeight * 0.35;
        let current = Number(pages[0].dataset.vpage);
        for (const el of pages) {
          if (el.getBoundingClientRect().top <= line) current = Number(el.dataset.vpage);
          else break;
        }
        setPage(current);
        setInput(String(current));
        const url = new URL(window.location.href);
        if (url.searchParams.get("page") !== String(current)) {
          url.searchParams.set("page", String(current));
          window.history.replaceState(window.history.state, "", url);
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [ready]);

  const zoomBy = (dir: 1 | -1) => setZoom((z) => ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + dir))] ?? 1);
  const submitPage = () => {
    const n = Number.parseInt(input, 10);
    if (!Number.isFinite(n)) return setInput(String(page));
    const p = Math.max(1, Math.min(n, total ?? n));
    setInput(String(p));
    goTo(p);
  };

  const props: ViewProps = {
    url: fileUrl,
    zoom,
    onTotal: setTotal,
    onReady: () => setReady(true),
    onError: () => {
      setFailed(true);
      if (fallbackPages.length > 0) {
        setTotal(fallbackPages.at(-1)!.page);
        setReady(true);
      }
    },
  };
  const many = fileType !== "IMAGE" && (total ?? 0) > 1;

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/spaces/${spaceId}?tab=documents`}
          className="inline-flex min-h-11 min-w-0 items-center gap-1 rounded-control text-sm font-semibold text-fg-muted hover:text-fg lg:min-h-9"
        >
          <ChevronLeft aria-hidden className="size-4 shrink-0" />
          <span className="truncate">{spaceName} · Files</span>
        </Link>
        <ChatToggleButton />
      </div>

      {/* Toolbar */}
      <div ref={toolbar} className="sticky top-topbar z-20 -mx-1 mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-bg/95 px-1 py-2 backdrop-blur">
        <h1 dir="auto" className="min-w-0 flex-1 basis-full truncate text-[0.9375rem] font-semibold text-fg sm:basis-auto" title={title}>
          {title}
        </h1>
        {many && (
          <form
            className="flex items-center gap-1.5 text-sm text-fg-muted"
            onSubmit={(e) => {
              e.preventDefault();
              submitPage();
            }}
          >
            <label htmlFor="viewer-page">{unit(fileType)}</label>
            <input
              id="viewer-page"
              inputMode="numeric"
              value={input}
              onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 5))}
              onBlur={submitPage}
              className="h-11 w-14 rounded-control border border-border bg-surface px-2 text-center text-fg tabular-nums lg:h-9"
            />
            <span className="tabular-nums">of {total}</span>
          </form>
        )}
        <div className="flex items-center gap-1">
          <ToolButton label="Zoom out" onClick={() => zoomBy(-1)} disabled={zoom <= ZOOMS[0]}>
            <Minus className="size-4" aria-hidden />
          </ToolButton>
          <span className="w-12 text-center text-xs text-fg-muted tabular-nums" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <ToolButton label="Zoom in" onClick={() => zoomBy(1)} disabled={zoom >= ZOOMS[ZOOMS.length - 1]}>
            <Plus className="size-4" aria-hidden />
          </ToolButton>
          <ToolButton label="Fit width" onClick={() => setZoom(1)} disabled={zoom === 1}>
            <Maximize className="size-4" aria-hidden />
          </ToolButton>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Download original"
            title="Download original"
            className="inline-flex size-11 items-center justify-center rounded-control text-fg-muted hover:bg-surface hover:text-fg lg:size-9"
          >
            <Download className="size-4" aria-hidden />
          </a>
        </div>
      </div>

      {reading ? (
        <div ref={box} className="mt-4 pb-10">
          <p className="mb-3 text-xs text-fg-muted">Showing the text Vappi read from this file. The original couldn&apos;t be drawn here; use Download to see it.</p>
          <ol className="flex flex-col gap-3">
            {fallbackPages.map((p) => (
              <li key={p.page} data-vpage={p.page} className="rounded-card border border-border bg-surface/60 p-4">
                <p className="text-xs font-semibold text-fg-muted">
                  {unit(fileType)} {p.page}
                </p>
                <p dir="auto" className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-fg-body wrap-anywhere">
                  {p.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      ) : failed ? (
        <div role="alert" className="mt-6 flex flex-col items-start gap-3 rounded-card border border-border bg-surface/50 p-5">
          <p className="text-sm font-semibold text-fg">Can&apos;t show this file here</p>
          <p className="text-sm text-fg-muted">You can still open the original.</p>
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-control bg-surface-active px-4 text-sm font-semibold text-fg hover:bg-border-strong lg:min-h-9">
            <Download className="size-4" aria-hidden />
            Download original
          </a>
        </div>
      ) : (
        // Zoomed pages pan inside this box; the page itself never scrolls sideways.
        <div ref={box} className="mt-4 overflow-x-auto pb-10">
          <div className="mx-auto" style={{ width: `${zoom * 100}%` }}>
            {fileType === "PDF" ? (
              <PdfView {...props} />
            ) : fileType === "DOCX" ? (
              <DocxView {...props} />
            ) : fileType === "PPTX" ? (
              <PptxView {...props} />
            ) : (
              <ImageView {...props} alt={title} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex size-11 items-center justify-center rounded-control text-fg-muted hover:bg-surface hover:text-fg disabled:pointer-events-none disabled:opacity-40 lg:size-9"
    >
      {children}
    </button>
  );
}
