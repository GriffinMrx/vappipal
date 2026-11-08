"use client";

import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  completeUpload,
  deleteDocument,
  prepareUpload,
  regenerateStudyMaterial,
  retryDocument,
} from "@/lib/documents/actions";
import { ACCEPT_ATTR, classifyFile, type DocumentView, type StudyPartName } from "@/lib/documents/types";
import type { UploadAllowance } from "@/lib/documents/queries";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { DocumentList } from "./document-list";
import { formatBytes } from "./file-type-icon";
import { UploadDropzone } from "./upload-dropzone";
import { UploadQueue, type QueueItem } from "./upload-queue";

type Limit = { limit: number; used: number };

const UPLOAD_INPUT_ID = "space-upload-input";

// Local ids for queue rows. Not crypto.randomUUID(): it only exists in secure
// contexts (HTTPS / localhost), so it crashes on http://<LAN IP>:3000.
let queueSeq = 0;
const nextQueueId = () => `upload-${Date.now()}-${++queueSeq}`;
const LIMIT_CARD_ID = "space-upload-limit";
/** How often the page re-reads document status while something is processing. */
const POLL_MS = 3000;

const regenTitle: Record<StudyPartName, string> = {
  summary: "Regenerate the summary?",
  flashcards: "Regenerate the flashcards?",
  quiz: "Regenerate the quiz?",
};
const regenDescription: Record<StudyPartName, string> = {
  summary: "The current summary will be replaced.",
  flashcards: "The current flashcards will be replaced and your review progress on them will be reset.",
  quiz: "The current questions and your answers to them will be replaced.",
};

/** POST the file to the bucket with real progress. Resolves when stored. */
function postToBucket(
  url: string,
  fields: Record<string, string>,
  file: File,
  onProgress: (pct: number) => void,
  signal: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    form.append("file", file); // must be the last field
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("upload")));
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort());
    xhr.send(form);
  });
}

/**
 * Space documents: upload queue (real progress) + list with optimistic
 * delete (AGENTS.md §7). The server is the source of truth: after each
 * action the page data refreshes through revalidatePath.
 */
export function SpaceDocuments({
  spaceId,
  documents,
  allowance,
}: {
  spaceId: string;
  documents: DocumentView[];
  allowance: UploadAllowance;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [retrying, setRetrying] = useState<ReadonlySet<string>>(new Set());
  const [generating, setGenerating] = useState<ReadonlySet<string>>(new Set());
  const [regenConfirm, setRegenConfirm] = useState<{ doc: DocumentView; part: StudyPartName } | null>(null);
  const [visible, removeOptimistic] = useOptimistic(documents, (state, id: string) =>
    state.filter((d) => d.id !== id),
  );
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [limitHit, setLimitHit] = useState<Limit | null>(null);
  const [confirm, setConfirm] = useState<DocumentView | null>(null);
  const controllers = useRef(new Map<string, AbortController>());
  const running = useRef(false);
  const pendingFiles = useRef<{ id: string; file: File }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Live status: re-read the server data every few seconds while anything is
  // processing; stop when nothing is, and pause while the tab is hidden.
  const processing = documents.some(
    (d) =>
      d.status === "PROCESSING" ||
      d.study.summary.status === "RUNNING" ||
      d.study.flashcards.status === "RUNNING" ||
      d.study.quiz.status === "RUNNING",
  );
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [processing, router]);

  async function retry(doc: DocumentView) {
    setRetrying((s) => new Set(s).add(doc.id));
    try {
      const res = await retryDocument({ documentId: doc.id });
      if (!res.ok) toast({ tone: "error", title: "Couldn't retry", description: res.error });
    } catch {
      toast({ tone: "error", title: "Couldn't retry", description: "Check your connection and try again." });
    } finally {
      setRetrying((s) => {
        const next = new Set(s);
        next.delete(doc.id);
        return next;
      });
    }
  }

  /** Starts generation; rejects if it couldn't start (so the AI button shows "Try again"). */
  async function generate(doc: DocumentView, part: StudyPartName | "all") {
    setGenerating((s) => new Set(s).add(doc.id));
    let res: Awaited<ReturnType<typeof regenerateStudyMaterial>>;
    try {
      res = await regenerateStudyMaterial({ documentId: doc.id, part });
    } catch (err) {
      toast({ tone: "error", title: "Couldn't start", description: "Check your connection and try again." });
      throw err;
    } finally {
      setGenerating((s) => {
        const next = new Set(s);
        next.delete(doc.id);
        return next;
      });
    }
    if (!res.ok) {
      toast({ tone: "error", title: "Couldn't start", description: res.error });
      throw new Error(res.error);
    }
    router.refresh();
  }

  const limitReached =
    limitHit ??
    (allowance.limit !== null && allowance.used >= allowance.limit
      ? { limit: allowance.limit, used: allowance.used }
      : null);

  const update = (id: string, patch: Partial<QueueItem>) =>
    setQueue((q) => q.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const remove = (id: string) => setQueue((q) => q.filter((i) => i.id !== id));
  const fail = (id: string, error: string) => update(id, { state: "error", error });

  async function uploadOne(id: string, file: File) {
    const controller = new AbortController();
    controllers.current.set(id, controller);
    try {
      update(id, { state: "uploading", progress: 0 });
      const prep = await prepareUpload({ spaceId, fileName: file.name, size: file.size });
      if (!prep.ok) {
        if ("limitReached" in prep) {
          setLimitHit(prep.limitReached);
          return remove(id);
        }
        return fail(id, prep.error);
      }
      await postToBucket(prep.url, prep.fields, file, (p) => update(id, { progress: p }), controller.signal);
      update(id, { state: "finishing" });
      const done = await completeUpload({ spaceId, key: prep.key, fileName: file.name });
      if (!done.ok) {
        if ("limitReached" in done) {
          setLimitHit(done.limitReached);
          return remove(id);
        }
        return fail(id, done.error);
      }
      remove(id); // the refreshed server list now shows it as Processing
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return remove(id);
      fail(id, "Upload failed. Check your connection and try again.");
    } finally {
      controllers.current.delete(id);
    }
  }

  async function drain() {
    if (running.current) return;
    running.current = true;
    while (pendingFiles.current.length) {
      const next = pendingFiles.current.shift()!;
      await uploadOne(next.id, next.file);
    }
    running.current = false;
  }

  function addFiles(files: File[]) {
    const items: QueueItem[] = [];
    for (const file of files) {
      const id = nextQueueId();
      const kind = classifyFile(file.name);
      const base = { id, name: file.name, size: file.size, progress: 0 };
      // Quick client checks; the server checks everything again.
      if (!kind.ok) items.push({ ...base, state: "error", error: kind.reason });
      else if (file.size === 0) items.push({ ...base, state: "error", error: "This file is empty." });
      else if (file.size > allowance.maxBytes)
        items.push({
          ...base,
          state: "error",
          error: `This file is ${formatBytes(file.size)}. Files can be up to ${formatBytes(allowance.maxBytes)}${allowance.pro ? "" : " on the Free plan"}.`,
        });
      else {
        items.push({ ...base, state: "waiting" });
        pendingFiles.current.push({ id, file });
      }
    }
    setQueue((q) => [...q, ...items]);
    void drain();
  }

  function cancel(id: string) {
    pendingFiles.current = pendingFiles.current.filter((p) => p.id !== id);
    const c = controllers.current.get(id);
    if (c) c.abort();
    else remove(id);
  }

  function confirmDelete(doc: DocumentView) {
    setConfirm(null);
    startTransition(async () => {
      removeOptimistic(doc.id);
      try {
        const res = await deleteDocument({ documentId: doc.id });
        if (!res.ok) throw new Error(res.error);
        setLimitHit(null);
        toast({ tone: "success", title: "Document deleted" });
      } catch {
        // The optimistic removal rolls back on its own.
        toast({
          tone: "error",
          title: "Document not deleted",
          description: "Check your connection and try again.",
        });
      }
    });
  }

  const maxLabel = formatBytes(allowance.maxBytes).replace(".0 ", " ");
  const hasDocs = visible.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {limitReached ? (
        <Card
          id={LIMIT_CARD_ID}
          className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-fg">
              You&apos;ve used {limitReached.used} of {limitReached.limit} free documents
            </p>
            <p className="text-xs text-fg-muted">
              Upgrade to Pro for unlimited uploads, or delete a document to make room.
            </p>
          </div>
          <Link href="/billing" className={buttonClasses({ variant: "accent", size: "md", className: "shrink-0" })}>
            Upgrade
          </Link>
        </Card>
      ) : (
        <UploadDropzone
          accept={ACCEPT_ATTR}
          maxLabel={maxLabel}
          compact={hasDocs}
          onFiles={addFiles}
          inputRef={inputRef}
          inputId={UPLOAD_INPUT_ID}
        />
      )}

      <UploadQueue items={queue} onCancel={cancel} onDismiss={remove} />

      {hasDocs && <DocumentList
          spaceId={spaceId}
          documents={visible}
          onDelete={setConfirm}
          onRetry={retry}
          retrying={retrying}
          onGenerate={generate}
          onRegenerate={(doc, part) => setRegenConfirm({ doc, part })}
          generating={generating}
        />}

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title="Delete this document?"
        description={
          confirm ? `“${confirm.title}” and its summary, flashcards and quiz questions will be deleted.` : undefined
        }
        closeLabel="Close"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => confirm && confirmDelete(confirm)}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-xs text-fg-muted">This can&apos;t be undone.</p>
      </Dialog>

      <Dialog
        open={regenConfirm !== null}
        onClose={() => setRegenConfirm(null)}
        title={regenConfirm ? regenTitle[regenConfirm.part] : ""}
        description={regenConfirm ? regenDescription[regenConfirm.part] : undefined}
        closeLabel="Close"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRegenConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!regenConfirm) return;
                const { doc, part } = regenConfirm;
                setRegenConfirm(null);
                generate(doc, part).catch(() => {});
              }}
            >
              Regenerate
            </Button>
          </>
        }
      >
        <p className="text-xs text-fg-muted">It only uses this document&apos;s own pages.</p>
      </Dialog>
    </div>
  );
}

/** Header "Upload" button: opens the page's file picker, or shows the limit card. */
export function UploadButton({ icon }: { icon?: React.ReactNode }) {
  return (
    <Button
      variant="secondary"
      icon={icon}
      onClick={() => {
        const input = document.getElementById(UPLOAD_INPUT_ID) as HTMLInputElement | null;
        if (input) input.click();
        else document.getElementById(LIMIT_CARD_ID)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }}
    >
      Upload
    </Button>
  );
}
