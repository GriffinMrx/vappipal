"use client";

import { cn } from "@/lib/cn";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconButton } from "./icon-button";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  closeLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/**
 * Modal built on the native <dialog> element: focus trap, Esc to close,
 * and focus restoration come from the browser.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  closeLabel,
  children,
  footer,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

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
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-md rounded-card border border-border bg-surface p-0 text-fg-body shadow-2xl backdrop:bg-black/70 open:animate-fade-in",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 p-5 pb-3">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="text-base font-bold text-fg">
            {title}
          </h2>
          {description && (
            <p id={descId} className="text-xs text-fg-muted">
              {description}
            </p>
          )}
        </div>
        <IconButton label={closeLabel} onClick={onClose} className="-me-2 -mt-2">
          <X className="size-4" />
        </IconButton>
      </div>
      <div className="px-5 pb-5">{children}</div>
      {footer && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4">
          {footer}
        </div>
      )}
    </dialog>
  );
}
