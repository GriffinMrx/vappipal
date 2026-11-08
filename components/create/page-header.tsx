"use client";

import { popoverClasses, usePopover } from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { BANNER_KEYS, BANNERS, EMOJIS, TITLE_MAX, type BannerKey } from "@/lib/creations/types";
import { ImagePlus, Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Double-click to rename; Enter or clicking outside saves, Esc cancels. */
export function InlineTitle({
  value,
  onCommit,
  disabled,
}: {
  value: string;
  onCommit: (next: string) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== value) onCommit(next);
    else setDraft(value);
  };

  if (editing) {
    return (
      <input
        ref={input}
        aria-label="Title"
        value={draft}
        maxLength={TITLE_MAX}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="w-full rounded-control bg-surface px-2 py-1 -mx-2 text-[2rem] leading-tight font-bold text-fg outline-none ring-1 ring-border-strong sm:text-[2.5rem]"
      />
    );
  }
  return (
    <h1
      title={disabled ? undefined : "Double-click to rename"}
      onDoubleClick={() => {
        if (disabled) return;
        setDraft(value);
        setEditing(true);
      }}
      className={cn(
        "text-[2rem] leading-tight font-bold text-fg wrap-anywhere sm:text-[2.5rem]",
        !disabled && "cursor-text rounded-control hover:bg-surface/50",
      )}
    >
      {value}
    </h1>
  );
}

/** The big emoji above the title: click → pick one (or remove). */
export function EmojiButton({ icon, onPick, disabled }: { icon: string | null; onPick: (e: string | null) => void; disabled?: boolean }) {
  const { popoverRef, triggerProps, hide } = usePopover();
  return (
    <>
      <button
        type="button"
        aria-label={icon ? "Change icon" : "Add icon"}
        disabled={disabled}
        {...triggerProps}
        className={cn(
          "inline-flex items-center justify-center rounded-card transition-colors hover:bg-surface",
          icon ? "size-20 text-[3.5rem] leading-none sm:size-24 sm:text-[4.25rem]" : "h-11 gap-1.5 px-2 text-sm text-fg-muted lg:h-8",
        )}
      >
        {icon ?? (
          <>
            <Smile aria-hidden className="size-4" /> Add icon
          </>
        )}
      </button>
      <div ref={popoverRef} popover="auto" className={cn(popoverClasses, "w-[min(20rem,calc(100vw-1rem))] p-2")}>
        <div className="grid grid-cols-8 gap-1">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              aria-label={e}
              onClick={() => {
                onPick(e);
                hide(false);
              }}
              className={cn(
                "inline-flex size-9 items-center justify-center rounded-control text-xl hover:bg-surface-active",
                icon === e && "bg-surface-active",
              )}
            >
              {e}
            </button>
          ))}
        </div>
        {icon && (
          <button
            type="button"
            onClick={() => {
              onPick(null);
              hide(false);
            }}
            className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-control text-xs font-semibold text-fg-muted hover:bg-surface-active hover:text-fg"
          >
            Remove icon
          </button>
        )}
      </div>
    </>
  );
}

/** "Add banner" / "Change banner": a choice of design-palette gradients. */
export function BannerButton({
  banner,
  onPick,
  disabled,
}: {
  banner: BannerKey | null;
  onPick: (b: BannerKey | null) => void;
  disabled?: boolean;
}) {
  const { popoverRef, triggerProps, hide } = usePopover();
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        {...triggerProps}
        className="inline-flex h-11 items-center gap-1.5 rounded-control px-2 text-sm text-fg-muted hover:bg-surface hover:text-fg lg:h-8"
      >
        <ImagePlus aria-hidden className="size-4" />
        {banner ? "Change banner" : "Add banner"}
      </button>
      <div ref={popoverRef} popover="auto" className={cn(popoverClasses, "w-[min(18rem,calc(100vw-1rem))] p-2")}>
        <div className="grid grid-cols-2 gap-2">
          {BANNER_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              aria-label={`${k} banner`}
              onClick={() => {
                onPick(k);
                hide(false);
              }}
              className={cn("h-14 rounded-control", banner === k && "ring-2 ring-fg ring-offset-2 ring-offset-surface")}
              style={{ background: BANNERS[k] }}
            />
          ))}
        </div>
        {banner && (
          <button
            type="button"
            onClick={() => {
              onPick(null);
              hide(false);
            }}
            className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-control text-xs font-semibold text-fg-muted hover:bg-surface-active hover:text-fg"
          >
            Remove banner
          </button>
        )}
      </div>
    </>
  );
}
