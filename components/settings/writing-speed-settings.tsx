"use client";

import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { setWritingSpeed } from "@/lib/settings/actions";
import { WRITING_SPEED_KEYS, WRITING_SPEEDS, type WritingSpeed } from "@/lib/settings/writing-speed";
import { useOptimistic, useTransition } from "react";
import { writingSpeedStore } from "./writing-speed-store";

/** How fast Vappi types and edits in your documents (optimistic; rolls back on failure). */
export function WritingSpeedSettings({ speed }: { speed: WritingSpeed }) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic(speed);

  function pick(next: WritingSpeed) {
    if (next === current) return;
    const prev = current;
    // Editors (this tab and others) switch at once; the server save follows.
    writingSpeedStore.set(next);
    startTransition(async () => {
      setCurrent(next);
      try {
        const res = await setWritingSpeed({ speed: next });
        if (!res.ok) throw new Error();
        // Saved: reload so every page in the app picks up the new speed for sure.
        window.location.reload();
      } catch {
        writingSpeedStore.set(prev); // roll back with the radio
        toast({ tone: "error", title: "Not saved", description: "Check your connection and try again." });
      }
    });
  }

  return (
    <Card className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-1">
        <p id="speed-label" className="text-sm font-bold text-fg">
          Writing speed
        </p>
        <p className="text-xs text-fg-muted">How fast Vappi types when it writes or edits your documents.</p>
      </div>
      <div role="radiogroup" aria-labelledby="speed-label" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {WRITING_SPEED_KEYS.map((k) => {
          const on = k === current;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pick(k)}
              className={cn(
                "flex min-h-14 flex-col items-start justify-center gap-0.5 rounded-control border px-3 py-2 text-start transition-colors",
                on ? "border-accent-bottom bg-accent-bottom/15 text-fg" : "border-border bg-surface text-fg-body hover:border-border-strong",
              )}
            >
              <span className="text-sm font-semibold">{WRITING_SPEEDS[k].label}</span>
              <span className="text-[0.6875rem] leading-snug text-fg-muted">{WRITING_SPEEDS[k].hint}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
