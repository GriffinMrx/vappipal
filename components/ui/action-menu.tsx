"use client";

import { cn } from "@/lib/cn";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { popoverClasses, usePopover } from "./popover";

export type ActionMenuItem = { id: string; label: string; icon?: ReactNode; disabled?: boolean };

/**
 * "⋯" style menu of actions (role=menu), in the same top-layer popover as the
 * other dropdowns. Keyboard: Up/Down, Home/End, Enter/Space, Esc.
 */
export function ActionMenu({
  label,
  trigger,
  items,
  onSelect,
  triggerClassName,
}: {
  label: string;
  trigger: ReactNode;
  items: ActionMenuItem[];
  onSelect: (id: string) => void;
  triggerClassName?: string;
}) {
  const id = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const { open, hide, popoverRef, triggerProps } = usePopover({ onOpen: () => setActive(0) });

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  const choose = (i: number) => {
    const item = items[i];
    if (!item || item.disabled) return;
    hide();
    onSelect(item.id);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const last = items.length - 1;
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive((a) => Math.min(last, a + 1)),
      ArrowUp: () => setActive((a) => Math.max(0, a - 1)),
      Home: () => setActive(0),
      End: () => setActive(last),
      Enter: () => choose(active),
      " ": () => choose(active),
      Escape: () => hide(),
      Tab: () => hide(),
    };
    const fn = keys[e.key];
    if (!fn) return;
    if (e.key !== "Tab") {
      e.preventDefault();
      e.stopPropagation();
    }
    fn();
  };

  return (
    <>
      <button
        type="button"
        aria-haspopup="menu"
        aria-label={label}
        title={label}
        aria-controls={`${id}-menu`}
        {...triggerProps}
        className={cn(
          "inline-flex size-11 shrink-0 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-surface hover:text-fg lg:size-10",
          triggerClassName,
        )}
      >
        {trigger}
      </button>
      <div
        ref={popoverRef}
        id={`${id}-menu`}
        popover="auto"
        className={cn(popoverClasses, "w-max max-w-[min(18rem,calc(100vw-1rem))] p-1.5")}
      >
        <ul
          ref={listRef}
          role="menu"
          aria-label={label}
          tabIndex={-1}
          aria-activedescendant={open ? `${id}-item-${active}` : undefined}
          onKeyDown={onKeyDown}
          className="flex flex-col gap-0.5 outline-none"
        >
          {items.map((item, i) => (
            <li
              key={item.id}
              id={`${id}-item-${i}`}
              role="menuitem"
              aria-disabled={item.disabled || undefined}
              onPointerMove={() => setActive(i)}
              onClick={() => choose(i)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[0.8125rem] font-medium transition-colors lg:min-h-9",
                i === active ? "bg-surface-hover text-fg" : "text-fg-muted",
                item.disabled && "cursor-not-allowed opacity-50",
              )}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              <span className="min-w-0 flex-1 wrap-anywhere">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
