"use client";

import { cn } from "@/lib/cn";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type ToastTone = "info" | "success" | "error";
type Toast = { id: number; tone: ToastTone; title: string; description?: string };
type ToastInput = Omit<Toast, "id"> & { durationMs?: number };

const ToastContext = createContext<{ toast: (t: ToastInput) => void } | null>(null);

const icons = {
  info: <Info className="size-4 text-fg-muted" />,
  success: <CircleCheck className="size-4 text-success" />,
  error: <CircleAlert className="size-4 text-danger" />,
};

export function ToastProvider({
  children,
  dismissLabel = "Dismiss",
}: {
  children: ReactNode;
  dismissLabel?: string;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ durationMs = 5000, ...t }: ToastInput) => {
      const id = ++nextId.current;
      setToasts((ts) => [...ts.slice(-3), { ...t, id }]);
      window.setTimeout(() => dismiss(id), durationMs);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:end-6 sm:bottom-6 sm:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-card border border-border bg-surface p-4 shadow-2xl",
              t.tone === "error" && "border-danger/40",
            )}
          >
            <span className="mt-0.5">{icons[t.tone]}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-sm font-semibold text-fg">{t.title}</p>
              {t.description && <p className="text-xs text-fg-muted">{t.description}</p>}
            </div>
            <button
              type="button"
              aria-label={dismissLabel}
              onClick={() => dismiss(t.id)}
              className="-m-1 rounded-md p-1 text-fg-subtle hover:text-fg"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
