"use client";

import { cn } from "@/lib/cn";
import { Check, ChevronsUpDown } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { popoverClasses, usePopover } from "./popover";

export type SelectMenuOption = { value: string; label: string; leading?: ReactNode };

type SelectMenuProps = {
  label: string;
  value: string;
  placeholder: string;
  options: SelectMenuOption[];
  onSelect: (value: string) => void;
  triggerClassName?: string;
  className?: string;
};

/** Custom dropdown (listbox) in the Vappi style. Replaces the native <select>. */
export function SelectMenu({
  label,
  value,
  placeholder,
  options,
  onSelect,
  triggerClassName,
  className,
}: SelectMenuProps) {
  const id = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const [active, setActive] = useState(0);
  const onOpen = useCallback(() => setActive(Math.max(0, selectedIndex)), [selectedIndex]);
  const { open, hide, popoverRef, triggerProps } = usePopover({ matchWidth: true, onOpen });
  const selected = options[selectedIndex];

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${id}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);

  const choose = (i: number) => {
    const o = options[i];
    hide();
    if (o && o.value !== value) onSelect(o.value);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const last = options.length - 1;
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
    <div className={className}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-label={label}
        aria-controls={`${id}-pop`}
        {...triggerProps}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            triggerProps.onClick();
          }
        }}
        className={cn("flex w-full items-center gap-2 text-start", triggerClassName)}
      >
        <span className={cn("min-w-0 flex-1 wrap-anywhere", !selected && "opacity-90")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronsUpDown aria-hidden className="size-3 shrink-0 text-sidebar-switcher-icon" />
      </button>

      <div
        ref={popoverRef}
        id={`${id}-pop`}
        popover="auto"
        className={cn(popoverClasses, "w-max max-w-[min(20rem,calc(100vw-1rem))] p-1.5")}
      >
        <ul
          ref={listRef}
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
          onKeyDown={onKeyDown}
          className="flex flex-col gap-0.5 outline-none"
        >
          {options.map((o, i) => {
            const isSelected = o.value === value;
            return (
              <li
                key={o.value}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={isSelected}
                onPointerMove={() => setActive(i)}
                onClick={() => choose(i)}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[0.8125rem] font-medium transition-colors lg:min-h-9",
                  i === active ? "bg-surface-hover text-fg" : "text-fg-muted",
                )}
              >
                {o.leading}
                <span className="min-w-0 flex-1 wrap-anywhere">{o.label}</span>
                <Check
                  aria-hidden
                  className={cn("size-3.5 shrink-0 text-fg-body", !isSelected && "invisible")}
                  strokeWidth={2.5}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
