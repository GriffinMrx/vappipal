import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-active text-fg-muted",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-pill px-2.5 text-[0.6875rem] font-semibold",
        tones[tone],
        className,
      )}
    >
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export type DocumentStatus = "PROCESSING" | "READY" | "FAILED";

const statusTone: Record<DocumentStatus, Tone> = {
  PROCESSING: "warning",
  READY: "success",
  FAILED: "danger",
};

/** Document status pill. Text comes from the caller so it can be translated. */
export function StatusBadge({
  status,
  label,
  className,
}: {
  status: DocumentStatus;
  label: string;
  className?: string;
}) {
  return (
    <Badge tone={statusTone[status]} dot className={className}>
      <span className={cn(status === "PROCESSING" && "animate-pulse")}>{label}</span>
    </Badge>
  );
}
