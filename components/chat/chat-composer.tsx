"use client";

import { CHAT_MESSAGE_MAX } from "@/lib/chat/types";
import { cn } from "@/lib/cn";
import { ArrowUp, BookOpen, FileText, Square, X } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent } from "react";

/**
 * Chat composer: the reference's shape (rounded gradient card, chip bottom-left,
 * round send key bottom-right) in Vappi's accent colours, with the same edge
 * highlights as the `accent` button.
 */
export function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  spaceName,
  large,
  placeholder = "Ask about your files…",
  chip,
  chipIcon = "book",
  onChipClear,
  maxLength = CHAT_MESSAGE_MAX,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  spaceName: string;
  /** Expanded view: taller box. */
  large?: boolean;
  placeholder?: string;
  /** Chip text (defaults to the Space name). */
  chip?: string;
  chipIcon?: "book" | "doc";
  /** Shows an × on the chip (e.g. drop the selection). */
  onChipClear?: () => void;
  maxLength?: number;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const maxHeight = large ? 216 : 140;

  // Auto-grow up to ~8 lines (expanded) or ~5 (panel).
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [value, maxHeight]);

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
      className={cn(
        "relative isolate flex flex-col gap-2 overflow-hidden rounded-[1.25rem] p-3 sm:p-4",
        // Dark at the top, lit at the bottom (the reference's light coming from below).
        "bg-linear-to-b from-accent-top via-[#2c1260] to-accent-bottom",
        // Edges as inset shadows (like the accent button): rim, bright top line, brighter bottom, outer glow.
        "shadow-[inset_0_0_0_1px_rgb(110_80_170/0.55),inset_0_1px_0_0_rgb(225_205_255/0.55),inset_0_-1px_0_0_rgb(200_165_255/0.9),0_14px_50px_-10px_rgb(120_60_220/0.65),0_-6px_30px_-14px_rgb(200_170_255/0.35)]",
      )}
    >
      {/* Light at the top: a bright line across the top edge with a soft glow under it. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-[12%] top-0 -z-10 h-px bg-linear-to-r from-transparent via-white/85 to-transparent"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-[20%] -top-6 -z-10 h-12 rounded-full bg-[rgb(200_170_255/0.28)] blur-xl"
      />
      {/* Light at the bottom: a bright bloom rising from under the box. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-3/4 bg-[radial-gradient(ellipse_65%_80%_at_50%_115%,rgb(186_140_255/0.75),rgb(130_70_230/0.35)_45%,transparent_75%)]"
      />
      <label htmlFor="chat-input" className="sr-only">
        Ask about {spaceName}
      </label>
      <textarea
        id="chat-input"
        ref={input}
        rows={large ? 2 : 1}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="min-h-11 w-full resize-none bg-transparent px-1 py-1.5 text-base leading-6 text-accent-fg placeholder:text-accent-fg/55 focus:outline-none sm:text-sm"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-pill bg-black/20 px-2.5 py-1 text-xs font-semibold text-accent-fg/85">
          {chipIcon === "doc" ? (
            <FileText aria-hidden className="size-3.5 shrink-0" />
          ) : (
            <BookOpen aria-hidden className="size-3.5 shrink-0" />
          )}
          <span className="truncate">{chip ?? spaceName}</span>
          {onChipClear && (
            <button
              type="button"
              onClick={onChipClear}
              aria-label="Use the whole document"
              title="Use the whole document"
              className="-my-2 -me-2 inline-flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-black/25"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          )}
        </span>
        {busy ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop answering"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-fg text-bg transition-colors hover:bg-fg-body lg:size-8"
          >
            <Square className="size-3 fill-current" aria-hidden />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!value.trim()}
            aria-label="Send"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-fg text-bg transition-colors hover:bg-fg-body disabled:opacity-40 lg:size-8"
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </form>
  );
}
