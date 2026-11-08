"use client";

import { viewerHref } from "@/lib/documents/viewer";
import { ActionMenu } from "@/components/ui/action-menu";
import { AiButton } from "@/components/ui/ai-button";
import { StatusBadge } from "@/components/ui/badge";
import { Button, buttonClasses, Spinner } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";
import { isAiLimitMessage } from "@/lib/ai/messages";
import { cn } from "@/lib/cn";
import { NOTE_CARD_LIMIT, NOTE_NOT_ENOUGH_TEXT, type DocumentView, type StudyPartName } from "@/lib/documents/types";
import { Ellipsis, ExternalLink, RotateCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { FileTypeIcon, fileTypeLabel, formatBytes } from "./file-type-icon";

const statusLabel = { PROCESSING: "Processing", READY: "Ready", FAILED: "Failed" } as const;
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

const runningLabel: Record<StudyPartName, string> = {
  summary: "Writing the summary…",
  flashcards: "Making flashcards…",
  quiz: "Writing quiz questions…",
};
const failedLabel: Record<StudyPartName, string> = {
  summary: "The summary couldn't be created.",
  flashcards: "Flashcards couldn't be created.",
  quiz: "The quiz couldn't be created.",
};
const PARTS: StudyPartName[] = ["summary", "flashcards", "quiz"];

/** "Reading page 12 of 40" / "Preparing for search…" while a document is processing. */
function progressOf(d: DocumentView): { label: string; value?: number } {
  const unit = d.fileType === "PPTX" ? "slide" : "page";
  if (d.stage === "SUMMARY") return { label: runningLabel.summary };
  if (d.stage === "FLASHCARDS") return { label: runningLabel.flashcards };
  if (d.stage === "QUIZ") return { label: runningLabel.quiz };
  if (d.stage === "EMBED") return { label: "Preparing for search…" };
  if (d.pageCount && d.pagesProcessed > 0) {
    return {
      label: `Reading ${unit} ${Math.min(d.pagesProcessed, d.pageCount)} of ${d.pageCount}`,
      value: Math.round((d.pagesProcessed / d.pageCount) * 100),
    };
  }
  return { label: "Starting…" };
}

/** What a Ready document's study material looks like: counts, running parts, failures, notes. */
function StudyLine({
  d,
  onGenerate,
  busy,
}: {
  d: DocumentView;
  onGenerate: (part: StudyPartName | "all") => Promise<void>;
  busy: boolean;
}) {
  const { summary, flashcards, quiz } = d.study;
  const untouched = PARTS.every((p) => d.study[p].status === "PENDING" && d.study[p].count === 0);
  if (untouched) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-xs text-fg-subtle">No learning material yet.</span>
        <AiButton size="sm" loadingLabel={["Reading", "Writing"]} disabled={busy} onClick={() => onGenerate("all")}>
          Make summary, cards and quiz
        </AiButton>
      </div>
    );
  }

  const done: string[] = [];
  if (summary.status === "DONE" && summary.count) done.push("Summary");
  if (flashcards.status === "DONE" && flashcards.count)
    done.push(`${flashcards.count} flashcard${flashcards.count === 1 ? "" : "s"}`);
  if (quiz.status === "DONE" && quiz.count) done.push(`${quiz.count} question${quiz.count === 1 ? "" : "s"}`);
  const notEnough = PARTS.some((p) => d.study[p].status === "DONE" && d.study[p].message === NOTE_NOT_ENOUGH_TEXT);
  // Daily AI limit: one line with the reset time (built on the server), under the failed parts.
  const limitMessage = PARTS.map((p) => d.study[p]).find((s) => s.status === "FAILED" && isAiLimitMessage(s.message))?.message;

  return (
    <div className="mt-1 flex flex-col gap-1.5">
      {done.length > 0 && <p className="text-xs text-fg-muted">{done.join(" · ")}</p>}
      {notEnough && <p className="text-xs text-fg-subtle">{NOTE_NOT_ENOUGH_TEXT}</p>}
      {PARTS.filter((p) => d.study[p].status === "RUNNING").map((p) => (
        <p key={p} className="flex items-center gap-2 text-xs text-fg-subtle">
          <Spinner className="size-3" />
          {runningLabel[p]}
        </p>
      ))}
      {PARTS.filter((p) => d.study[p].status === "FAILED").map((p) => (
        <div key={p} className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-xs text-danger">{failedLabel[p]}</span>
          <AiButton size="sm" loadingLabel="Writing" disabled={busy} onClick={() => onGenerate(p)}>
            Retry
          </AiButton>
        </div>
      ))}
      {limitMessage && <p className="text-xs wrap-break-word text-fg-subtle">{limitMessage}</p>}
      {flashcards.status === "DONE" && flashcards.message === NOTE_CARD_LIMIT && (
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
          {flashcards.message}
          <Link href="/billing" className="inline-flex min-h-11 items-center font-semibold text-fg underline underline-offset-2 lg:min-h-0">
            Upgrade
          </Link>
        </p>
      )}
    </div>
  );
}

export function DocumentList({
  spaceId,
  documents,
  onDelete,
  onRetry,
  retrying,
  onGenerate,
  onRegenerate,
  generating,
}: {
  spaceId: string;
  documents: DocumentView[];
  onDelete: (doc: DocumentView) => void;
  onRetry: (doc: DocumentView) => void;
  /** Ids whose retry request is in flight. */
  retrying: ReadonlySet<string>;
  /** Create or retry study material (no confirm). Rejects when it couldn't start. */
  onGenerate: (doc: DocumentView, part: StudyPartName | "all") => Promise<void>;
  /** Regenerate existing study material (asks to confirm first). */
  onRegenerate: (doc: DocumentView, part: StudyPartName) => void;
  /** Ids whose generate request is in flight. */
  generating: ReadonlySet<string>;
}) {
  return (
    <ul className="flex flex-col gap-2" aria-label="Documents">
      {documents.map((d) => (
        <li key={d.id}>
          <Card
            className={cn(
              "flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4",
              d.pending && "opacity-50",
            )}
          >
            <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
              <span className="mt-0.5 shrink-0 text-fg-muted sm:mt-0">
                <FileTypeIcon type={d.fileType} />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <p dir="auto" className="text-sm font-semibold wrap-anywhere text-fg-body">
                  {d.title}
                </p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
                  <span>
                    {fileTypeLabel[d.fileType]} · {formatBytes(d.sizeBytes)}
                    {d.pageCount && d.status === "READY"
                      ? ` · ${d.pageCount} ${d.fileType === "PPTX" ? "slide" : "page"}${d.pageCount === 1 ? "" : "s"}`
                      : ""}{" "}
                    ·{" "}
                    {dateFormat.format(new Date(d.createdAt))}
                  </span>
                  <StatusBadge status={d.status} label={statusLabel[d.status]} />
                </p>
                {d.status === "PROCESSING" && !d.pending && (
                  <div className="mt-1 flex max-w-xs flex-col gap-1.5">
                    <Progress label={`Processing ${d.title}`} value={progressOf(d).value} />
                    <span className="text-xs text-fg-subtle">{progressOf(d).label}</span>
                  </div>
                )}
                {d.status === "FAILED" && d.failureReason && (
                  <p className="text-xs text-danger">{d.failureReason}</p>
                )}
                {d.status === "READY" && !d.pending && (
                  <StudyLine d={d} busy={generating.has(d.id)} onGenerate={(part) => onGenerate(d, part)} />
                )}
                {d.status === "READY" && d.ocrUsed && (
                  <p className="text-xs text-fg-subtle">
                    Some pages were read from images. Check the original if something looks off.
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1 ps-9 sm:ps-0">
              {d.status === "FAILED" && (
                <Button
                  variant="subtle"
                  size="sm"
                  icon={<RotateCw className="size-4" />}
                  loading={retrying.has(d.id)}
                  disabled={d.pending}
                  onClick={() => onRetry(d)}
                >
                  Retry
                </Button>
              )}
              <Link
                href={viewerHref(spaceId, d.id)}
                aria-disabled={d.pending}
                className={cn(
                  buttonClasses({ variant: "ghost", size: "sm" }),
                  d.pending && "pointer-events-none",
                )}
              >
                <ExternalLink className="size-4" />
                Open
              </Link>
              {d.status === "READY" && !d.pending && (
                <ActionMenu
                  label={`More actions for ${d.title}`}
                  trigger={<Ellipsis className="size-4" />}
                  items={PARTS.map((p) => ({
                    id: p,
                    label: `Regenerate ${p === "quiz" ? "quiz" : p}`,
                    icon: <RotateCw className="size-3.5" />,
                    disabled: d.study[p].status === "RUNNING",
                  }))}
                  onSelect={(id) => onRegenerate(d, id as StudyPartName)}
                />
              )}
              <IconButton label={`Delete ${d.title}`} disabled={d.pending} onClick={() => onDelete(d)}>
                <Trash2 className="size-4" />
              </IconButton>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
