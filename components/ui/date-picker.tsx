"use client";

import { cn } from "@/lib/cn";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "./button";
import { IconButton } from "./icon-button";
import { inputClasses } from "./input";
import { popoverClasses, usePopover } from "./popover";

// Day strings ("YYYY-MM-DD") are handled in UTC so the browser's or server's
// time zone never shifts a date.
const toDate = (day: string) => new Date(`${day}T00:00:00Z`);
const toDay = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => {
  const d = toDate(day);
  d.setUTCDate(d.getUTCDate() + n);
  return toDay(d);
};
const addMonths = (day: string, n: number) => {
  const d = toDate(day);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), last));
  return toDay(target);
};
const monthStart = (day: string) => `${day.slice(0, 7)}-01`;
const localToday = () => {
  const d = new Date();
  return toDay(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
};

const fieldFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fullFormat = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

type DatePickerProps = {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  /** "YYYY-MM-DD" or "" */
  value: string;
  /** Earliest pickable day, "YYYY-MM-DD". */
  min?: string;
  onChange: (value: string) => void;
};

/** Date field with a custom calendar popover. Replaces <input type="date">. */
export function DatePicker({ name, label, hint, error, placeholder = "Pick a date", value, min, onChange }: DatePickerProps) {
  const id = useId();
  const triggerId = `${name}-trigger`;
  const gridRef = useRef<HTMLDivElement>(null);
  // "Today" is read when the calendar opens, never during render (prerender-safe).
  const [today, setToday] = useState("");
  const [focusDay, setFocusDay] = useState("");
  const onOpen = useCallback(() => {
    const t = min ?? localToday();
    setToday(t);
    setFocusDay(value || t);
  }, [value, min]);
  const { open, hide, popoverRef, triggerProps } = usePopover({ onOpen });

  const view = monthStart(focusDay || value || min || "2000-01-01");
  const lead = (toDate(view).getUTCDay() + 6) % 7; // Monday first
  const cells = Array.from({ length: 42 }, (_, i) => addDays(view, i - lead));
  const canGoBack = !min || monthStart(min) < view;
  const isDisabled = (day: string) => !!min && day < min;

  // Move keyboard focus to the focused day while the calendar is open.
  useEffect(() => {
    if (!open) return;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus();
  }, [open, focusDay]);

  const pick = (day: string) => {
    if (isDisabled(day)) return;
    onChange(day);
    hide();
  };

  const moveTo = (day: string) => setFocusDay(min && day < min ? min : day);

  const onGridKeyDown = (e: KeyboardEvent) => {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(focusDay, -1),
      ArrowRight: () => addDays(focusDay, 1),
      ArrowUp: () => addDays(focusDay, -7),
      ArrowDown: () => addDays(focusDay, 7),
      PageUp: () => addMonths(focusDay, -1),
      PageDown: () => addMonths(focusDay, 1),
    };
    if (moves[e.key]) {
      e.preventDefault();
      moveTo(moves[e.key]());
    }
  };

  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={triggerId} className="text-xs font-semibold text-fg-muted">
        {label}
      </label>
      <button
        id={triggerId}
        type="button"
        aria-haspopup="dialog"
        aria-controls={`${id}-pop`}
        aria-describedby={describedBy}
        {...triggerProps}
        className={cn(inputClasses, "flex items-center gap-2 text-start aria-expanded:border-fg-subtle", error && "border-danger")}
      >
        <span className={cn("min-w-0 flex-1 wrap-anywhere", !value && "text-fg-subtle")}>
          {value ? fieldFormat.format(toDate(value)) : placeholder}
        </span>
        <CalendarDays aria-hidden className="size-4 shrink-0 text-fg-muted" />
      </button>
      {error ? (
        <p id={`${name}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="text-xs text-fg-subtle">
          {hint}
        </p>
      ) : null}

      <div
        ref={popoverRef}
        id={`${id}-pop`}
        popover="auto"
        role="dialog"
        aria-label={label}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            hide();
          }
        }}
        className={cn(popoverClasses, "w-[min(20rem,calc(100vw-1rem))] p-3 lg:w-[18rem]")}
      >
        <div className="flex items-center justify-between gap-2">
          <IconButton label="Previous month" disabled={!canGoBack} onClick={() => moveTo(addMonths(focusDay, -1))}>
            <ChevronLeft className="size-4" />
          </IconButton>
          <p aria-live="polite" className="text-sm font-semibold text-fg">
            {monthFormat.format(toDate(view))}
          </p>
          <IconButton label="Next month" onClick={() => moveTo(addMonths(focusDay, 1))}>
            <ChevronRight className="size-4" />
          </IconButton>
        </div>

        <div className="mt-2 grid grid-cols-7 text-center text-[0.6875rem] font-semibold text-fg-subtle" aria-hidden>
          {WEEKDAYS.map((d) => (
            <span key={d} className="py-1.5">
              {d}
            </span>
          ))}
        </div>

        <div ref={gridRef} role="group" aria-label={monthFormat.format(toDate(view))} onKeyDown={onGridKeyDown} className="grid grid-cols-7 gap-y-0.5">
          {cells.map((day) => {
            const inMonth = day.slice(0, 7) === view.slice(0, 7);
            const disabled = isDisabled(day);
            const selected = day === value;
            return (
              <button
                key={day}
                type="button"
                data-day={day}
                tabIndex={day === focusDay ? 0 : -1}
                disabled={disabled}
                aria-pressed={selected}
                aria-label={fullFormat.format(toDate(day))}
                onClick={() => pick(day)}
                className={cn(
                  "flex h-11 items-center justify-center rounded-control text-[0.8125rem] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg-subtle lg:h-9",
                  selected
                    ? "bg-fg text-bg"
                    : disabled
                      ? "cursor-not-allowed text-fg-subtle/35"
                      : inMonth
                        ? "text-fg-body hover:bg-surface-hover hover:text-fg"
                        : "text-fg-subtle/70 hover:bg-surface-hover",
                  !selected && day === today && "ring-1 ring-border-strong ring-inset",
                )}
              >
                {Number(day.slice(8))}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={!value}
            onClick={() => {
              onChange("");
              hide();
            }}
          >
            Clear
          </Button>
          <Button variant="ghost" size="sm" disabled={!today} onClick={() => pick(today)}>
            Today
          </Button>
        </div>
      </div>
    </div>
  );
}
