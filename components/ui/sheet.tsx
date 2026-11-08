"use client";

import { cn } from "@/lib/cn";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  closeLabel: string;
  children: ReactNode;
  className?: string;
};

/** Drag distance (px) past which releasing the handle closes the sheet. */
const CLOSE_DISTANCE = 80;

/**
 * Bottom sheet built on the native <dialog> element (focus trap, Esc, top
 * layer come from the browser). Slides up from the bottom; the grab handle
 * closes it on tap or when dragged down.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  closeLabel,
  children,
  className,
}: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const drag = useRef<{ startY: number; moved: boolean } | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const endDrag = (closeIt: boolean) => {
    drag.current = null;
    setDragging(false);
    setOffset(0);
    if (closeIt) onClose();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={offset ? { transform: `translateY(${offset}px)` } : undefined}
      className={cn(
        "mx-0 mt-auto mb-0 max-h-[90dvh] w-full max-w-none flex-col overflow-hidden rounded-t-card border-t border-border bg-bg-sidebar p-0 text-fg-body shadow-2xl backdrop:bg-black/70 open:flex open:animate-sheet-in",
        !dragging && "transition-transform duration-150",
        className,
      )}
    >
      <button
        type="button"
        aria-label={closeLabel}
        className="mx-auto flex h-11 w-24 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { startY: e.clientY, moved: false };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dy = Math.max(0, e.clientY - d.startY);
          if (dy > 4) d.moved = true;
          setOffset(dy);
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          if (!d) return;
          // A tap (no real movement) closes; a drag closes past the threshold.
          endDrag(!d.moved || e.clientY - d.startY > CLOSE_DISTANCE);
        }}
        onPointerCancel={() => endDrag(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClose();
          }
        }}
      >
        <span aria-hidden className="h-1.5 w-12 rounded-pill bg-border-strong" />
      </button>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
          <div className="flex flex-col items-center gap-1 text-center">
            <h2 id={titleId} className="text-base font-bold break-words text-fg">
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-xs text-fg-muted">
                {description}
              </p>
            )}
          </div>
          {children}
        </div>
      </div>
    </dialog>
  );
}
