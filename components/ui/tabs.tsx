"use client";

import { cn } from "@/lib/cn";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type TabItem = { value: string; label: string; content?: ReactNode };

type TabsProps = {
  items: TabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  label: string;
  className?: string;
};

/** Pill tabs ("Videos / Archive" in the reference). */
export function Tabs({ items, defaultValue, value, onValueChange, label, className }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? items[0]?.value);
  const active = value ?? internal;
  const baseId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (v: string) => {
    if (value === undefined) setInternal(v);
    onValueChange?.(v);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = items.findIndex((i) => i.value === active);
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const nextKey = rtl ? "ArrowLeft" : "ArrowRight";
    const prevKey = rtl ? "ArrowRight" : "ArrowLeft";
    let next = -1;
    if (e.key === nextKey) next = (idx + 1) % items.length;
    else if (e.key === prevKey) next = (idx - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    select(items[next].value);
    refs.current[next]?.focus();
  };

  const activeItem = items.find((i) => i.value === active);

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex flex-wrap gap-2">
        {items.map((item, i) => {
          const selected = item.value === active;
          return (
            <button
              key={item.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              type="button"
              id={`${baseId}-tab-${item.value}`}
              aria-selected={selected}
              aria-controls={item.content ? `${baseId}-panel-${item.value}` : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(item.value)}
              className={cn(
                "h-11 rounded-pill px-5 text-sm font-semibold transition-colors",
                selected
                  ? "bg-surface-active text-fg"
                  : "text-fg-muted hover:bg-surface hover:text-fg",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {activeItem?.content && (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${activeItem.value}`}
          aria-labelledby={`${baseId}-tab-${activeItem.value}`}
          className="mt-6"
        >
          {activeItem.content}
        </div>
      )}
    </div>
  );
}
