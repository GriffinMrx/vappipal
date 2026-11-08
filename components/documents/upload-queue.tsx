"use client";

import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";
import { X } from "lucide-react";
import { FileTypeIcon, fileTypeFromName, formatBytes } from "./file-type-icon";

export type QueueItem = {
  id: string;
  name: string;
  size: number;
  /** 0–100 while uploading. */
  progress: number;
  state: "waiting" | "uploading" | "finishing" | "error";
  error?: string;
};

const stateLabel = (item: QueueItem) =>
  item.state === "waiting"
    ? "Waiting…"
    : item.state === "finishing"
      ? "Checking the file…"
      : item.state === "uploading"
        ? `${item.progress}%`
        : "";

/** One row per file being uploaded (real progress, not optimistic). */
export function UploadQueue({
  items,
  onCancel,
  onDismiss,
}: {
  items: QueueItem[];
  onCancel: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2" aria-label="Uploads">
      {items.map((item) => (
        <li key={item.id}>
          <Card className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 shrink-0 text-fg-muted">
              <FileTypeIcon type={fileTypeFromName(item.name)} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p dir="auto" className="min-w-0 text-sm font-semibold wrap-anywhere text-fg-body">
                  {item.name}
                </p>
                <span className="shrink-0 text-xs text-fg-subtle">
                  {formatBytes(item.size)}
                  {item.state !== "error" && ` · ${stateLabel(item)}`}
                </span>
              </div>
              {item.state === "error" ? (
                <p role="alert" className="text-xs text-danger">
                  {item.error}
                </p>
              ) : (
                <Progress
                  label={`Uploading ${item.name}`}
                  value={item.state === "uploading" ? item.progress : item.state === "finishing" ? 100 : 0}
                />
              )}
            </div>
            <IconButton
              label={item.state === "error" ? "Dismiss" : "Cancel upload"}
              onClick={() => (item.state === "error" ? onDismiss(item.id) : onCancel(item.id))}
              disabled={item.state === "finishing"}
              className="-me-2 -mt-1.5"
            >
              <X className="size-4" />
            </IconButton>
          </Card>
        </li>
      ))}
    </ul>
  );
}
