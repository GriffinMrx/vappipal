"use client";

import { viewerHref } from "@/lib/documents/viewer";
import Link from "next/link";
import { parseAnswer, type Inline } from "@/lib/chat/format";
import type { ChatSource } from "@/lib/chat/types";
import { ExternalLink } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { TypingDots } from "./ai-typing-indicator";

const unitOf = (s: ChatSource) => (s.fileType === "PPTX" ? "Slide" : s.fileType === "IMAGE" ? "Photo" : "Page");

/** In-app viewer at the cited page / slide (photos have no pages). */
const sourceHref = (spaceId: string, s: ChatSource) => viewerHref(spaceId, s.documentId, s.fileType === "IMAGE" ? null : s.page);

/**
 * A chat answer with paragraphs, lists, bold and [n] page pills. Built from
 * parsed data as React elements: model text is never inserted as HTML.
 * While streaming, new words fade in.
 */
export function AnswerText({
  text,
  sources,
  spaceId,
  streaming,
}: {
  text: string;
  sources: ChatSource[];
  spaceId: string;
  streaming?: boolean;
}) {
  const byN = new Map(sources.map((s) => [s.n, s]));
  const blocks = parseAnswer(text);
  let token = 0;

  const words = (t: string): ReactNode =>
    streaming
      ? t.split(/(?<=\s)/).map((w) => (
          <span key={`w${token++}`} className="animate-word-in motion-reduce:animate-none">
            {w}
          </span>
        ))
      : t;

  const inline = (items: Inline[]) => {
    const out: ReactNode[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "cite") {
        // Keep a run of pills and the punctuation right after them on one line ("… cave [1][6].").
        const pills: ReactNode[] = [];
        while (i < items.length && items[i].kind === "cite") {
          const s = byN.get((items[i] as { n: number }).n);
          if (s) pills.push(<CitePill key={`c${i}`} source={s} spaceId={spaceId} />); // unknown number: hidden
          i++;
        }
        let tail = "";
        const next = items[i];
        if (next?.kind === "text") {
          const m = /^[.,;:!?)]+/.exec(next.text);
          if (m) {
            tail = m[0];
            items = [...items.slice(0, i), { kind: "text", text: next.text.slice(tail.length) }, ...items.slice(i + 1)];
          }
        }
        i--;
        out.push(
          <span key={`g${i}`} className="whitespace-nowrap">
            {pills}
            {tail}
          </span>,
        );
        continue;
      }
      if (it.kind === "bold") out.push(<strong key={`b${i}`} className="font-semibold text-fg">{words(it.text)}</strong>);
      else if (it.text) out.push(<Fragment key={`t${i}`}>{words(it.text)}</Fragment>);
    }
    return out;
  };

  return (
    <div className="flex flex-col gap-3 text-[0.9375rem] leading-7 text-fg-body wrap-anywhere">
      {blocks.map((b, i) => {
        if (b.kind === "p") return <p key={i} dir="auto" className="whitespace-pre-line">{inline(b.content)}</p>;
        const List = b.kind === "ul" ? "ul" : "ol";
        return (
          <List
            key={i}
            dir="auto"
            start={b.kind === "ol" ? b.start : undefined}
            className={
              b.kind === "ul"
                ? "flex list-disc flex-col gap-1.5 ps-5 marker:text-accent-fg/70"
                : "flex list-decimal flex-col gap-1.5 ps-5 marker:font-semibold marker:text-fg-muted"
            }
          >
            {b.items.map((item, j) => (
              <li key={j} className="ps-1">
                {inline(item)}
              </li>
            ))}
          </List>
        );
      })}
      {streaming && <TypingDots className="-mt-1" />}
    </div>
  );
}

function CitePill({ source, spaceId }: { source: ChatSource; spaceId: string }) {
  const unit = unitOf(source);
  return (
    <Link
      href={sourceHref(spaceId, source)}
      title={`${unit} ${source.page} · ${source.title}`}
      aria-label={`Source ${source.n}: ${unit} ${source.page}, ${source.title}`}
      className="relative mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-accent-bottom/30 px-1 align-[0.1em] text-[0.6875rem] leading-none font-bold text-accent-fg no-underline hover:bg-accent-bottom/55 before:absolute before:-inset-3 before:content-[''] lg:before:hidden"
    >
      {source.n}
    </Link>
  );
}

/** The cited pages as small cards under the answer. */
export function SourceCards({ sources, spaceId }: { sources: ChatSource[]; spaceId: string }) {
  const seen = new Set<string>();
  const list = sources.filter((s) => {
    const k = `${s.documentId}:${s.page}`;
    return !seen.has(k) && seen.add(k);
  });
  if (list.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Sources">
      {list.map((s) => (
        <li key={`${s.documentId}:${s.page}`} className="min-w-0 max-w-full">
          <Link
            href={sourceHref(spaceId, s)}
            className="group flex min-h-11 max-w-full items-center gap-2 rounded-control border border-border bg-surface px-2.5 py-1.5 transition-colors hover:border-border-strong hover:bg-surface-hover lg:min-h-9"
          >
            <span className="shrink-0 rounded-md bg-accent-bottom/25 px-1.5 py-0.5 text-[0.6875rem] font-bold text-accent-fg">
              {unitOf(s) === "Photo" ? "Photo" : `${unitOf(s) === "Slide" ? "Slide" : "p."} ${s.page}`}
            </span>
            <span className="min-w-0 max-w-[14rem] truncate text-xs text-fg-muted group-hover:text-fg-body">{s.title}</span>
            <ExternalLink aria-hidden className="size-3.5 shrink-0 text-fg-subtle group-hover:text-fg-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
