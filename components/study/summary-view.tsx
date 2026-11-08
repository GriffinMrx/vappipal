"use client";

import { viewerHref } from "@/lib/documents/viewer";
import { Icon } from "@/components/icons/icon";
import { AiButton } from "@/components/ui/ai-button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectMenu } from "@/components/ui/select-menu";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { regenerateStudyMaterial } from "@/lib/documents/actions";
import { NOTE_NOT_ENOUGH_TEXT } from "@/lib/documents/types";
import { isAiLimitMessage } from "@/lib/ai/messages";
import type { SummaryEntry } from "@/lib/study/queries";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HighlightTerms } from "./highlight-terms";

export function SummaryView({
  spaceId,
  entries,
  selectedId,
}: {
  spaceId: string;
  entries: SummaryEntry[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [length, setLength] = useState<"short" | "long">("short");
  const entry = entries.find((e) => e.documentId === selectedId) ?? entries.find((e) => e.summary) ?? entries[0];
  const running = entry?.status === "RUNNING";

  // While the summary is being written, keep the page fresh.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), 3000);
    return () => clearInterval(t);
  }, [running, router]);

  if (!entry) {
    return (
      <EmptyState
        icon={<Icon name="note" size={24} />}
        title="No summaries yet"
        description="Upload a file to this Space. Its summary is written automatically."
        action={
          <Link href={`/spaces/${spaceId}`} className="text-sm font-semibold text-fg underline underline-offset-2">
            Go to documents
          </Link>
        }
      />
    );
  }

  const picker = entries.length > 1 && (
    <SelectMenu
      label="Choose a document"
      placeholder="Choose a document"
      value={entry.documentId}
      options={entries.map((e) => ({ value: e.documentId, label: e.title }))}
      onSelect={(id) => router.push(`/spaces/${spaceId}?tab=summary&doc=${id}`, { scroll: false })}
      className="w-full sm:w-80"
      triggerClassName="min-h-11 rounded-control border border-border px-3 text-sm text-fg-body hover:border-border-strong lg:min-h-10"
    />
  );

  const retry = async () => {
    const res = await regenerateStudyMaterial({ documentId: entry.documentId, part: "summary" });
    if (!res.ok) {
      toast({ tone: "error", title: "Couldn't start", description: res.error });
      throw new Error(res.error);
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      {picker}
      {!entry.summary ? (
        <EmptyState
          icon={<Icon name="note" size={24} />}
          title={
            running
              ? "Writing the summary…"
              : entry.status === "FAILED"
                ? "The summary couldn't be created"
                : "No summary for this document yet"
          }
          description={
            running
              ? "This takes a few seconds. The page updates by itself."
              : entry.message === NOTE_NOT_ENOUGH_TEXT || isAiLimitMessage(entry.message)
                ? entry.message
                : entry.title
          }
          action={
            !running && (
              <AiButton loadingLabel={["Reading", "Writing"]} onClick={retry}>
                {entry.status === "FAILED" ? "Try again" : "Write summary"}
              </AiButton>
            )
          }
        />
      ) : (
        <Card className="flex flex-col gap-5 px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 dir="auto" className="text-base font-bold wrap-anywhere text-fg">
                {entry.title}
              </h2>
              <Link
                href={viewerHref(spaceId, entry.documentId)}
                className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-fg-muted hover:text-fg lg:min-h-0"
              >
                <ExternalLink aria-hidden className="size-3.5" />
                Open document
              </Link>
            </div>
            <Tabs
              label="Summary length"
              value={length}
              onValueChange={(v) => setLength(v as "short" | "long")}
              items={[
                { value: "short", label: "Short" },
                { value: "long", label: "Long" },
              ]}
            />
          </div>

          {entry.summary.keyTerms.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-eyebrow font-semibold tracking-wide text-fg-subtle uppercase">Key terms</p>
              <ul className="flex flex-wrap gap-1.5">
                {entry.summary.keyTerms.map((t) => (
                  <li key={t} className="rounded-pill bg-accent-bottom/20 px-2.5 py-1 text-xs font-semibold text-fg">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p dir="auto" className="text-sm leading-7 wrap-break-word whitespace-pre-line text-fg-body sm:text-[0.9375rem]">
            <HighlightTerms
              text={length === "short" ? entry.summary.short : entry.summary.long}
              terms={entry.summary.keyTerms}
            />
          </p>
        </Card>
      )}
    </div>
  );
}
