"use client";

import { Icon } from "@/components/icons/icon";
import { cn } from "@/lib/cn";
import { useRef, useState, type DragEvent } from "react";

/**
 * Drop files here or browse. Large when the space is empty, one compact
 * row otherwise. The hidden input stays keyboard reachable via the button.
 */
export function UploadDropzone({
  accept,
  maxLabel,
  compact,
  disabled,
  onFiles,
  inputRef,
  inputId,
}: {
  accept: string;
  /** e.g. "20 MB" */
  maxLabel: string;
  compact?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  inputId?: string;
}) {
  const localRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? localRef;
  const [over, setOver] = useState(false);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn(
        "flex rounded-card border border-dashed border-border transition-colors",
        compact
          ? "flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4"
          : "flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        over && "border-border-strong bg-surface/50",
        disabled && "opacity-60",
      )}
    >
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-card bg-surface text-fg-muted",
          compact ? "size-10" : "size-12",
        )}
      >
        <Icon name="rectagular-upload" size={compact ? 20 : 24} />
      </span>
      <div className={cn("flex min-w-0 flex-col gap-1", compact && "flex-1")}>
        <p className="text-sm font-bold text-fg">
          {compact ? "Add more files" : "Upload your files"}
        </p>
        <p className="text-xs leading-relaxed text-fg-muted">
          Drop files here or{" "}
          <button
            type="button"
            disabled={disabled}
            onClick={() => ref.current?.click()}
            className="-my-3 inline-flex min-h-11 items-center font-semibold text-fg underline underline-offset-2 hover:text-fg-body lg:min-h-0"
          >
            browse
          </button>
          . PDF, PowerPoint, Word or photos · up to {maxLabel}
        </p>
      </div>
      <input
        ref={ref}
        id={inputId}
        type="file"
        multiple
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </div>
  );
}
