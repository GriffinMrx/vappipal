"use client";

import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { gradeFlashcard } from "@/lib/study/actions";
import type { ReviewCard } from "@/lib/study/queries";
import { formatDueIn, GRADES, schedule, type Grade } from "@/lib/study/sm2";
import Link from "next/link";
import { startTransition, useEffect, useOptimistic, useState } from "react";
import { SourceLink } from "./source-link";

const gradeLabel: Record<Grade, string> = { again: "Again", hard: "Hard", good: "Good", easy: "Easy" };
const gradeStyle: Record<Grade, string> = {
  again: "bg-danger/15 text-danger hover:bg-danger/25",
  hard: "bg-warning/15 text-warning hover:bg-warning/25",
  good: "bg-success/15 text-success hover:bg-success/25",
  easy: "bg-surface-active text-fg hover:bg-surface-hover",
};

type QueueAction = { id: string; again: boolean };

/** Remove the graded card; "Again" puts it back at the end of the session. */
function applyGrade(queue: ReviewCard[], { id, again }: QueueAction): ReviewCard[] {
  const card = queue.find((c) => c.id === id);
  const rest = queue.filter((c) => c.id !== id);
  return again && card ? [...rest, { ...card, repetitions: 0, intervalDays: 0 }] : rest;
}

/**
 * Due-card review, one card at a time (AGENTS.md §11). Grading is optimistic
 * (§7): the next card shows at once; the server applies SM-2 to the stored
 * card; on failure the card comes back and a toast explains.
 */
export function FlashcardReview({
  spaceId,
  cards,
  totalCards,
  nextDueAt,
  timeZone,
}: {
  spaceId: string;
  cards: ReviewCard[];
  totalCards: number;
  nextDueAt: string | null;
  timeZone: string;
}) {
  const { toast } = useToast();
  const [queue, setQueue] = useState(cards);
  const [shown, applyOptimistic] = useOptimistic(queue, applyGrade);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const card = shown[0];

  function grade(g: Grade) {
    if (!card) return;
    const action = { id: card.id, again: g === "again" };
    setFlipped(false);
    startTransition(async () => {
      applyOptimistic(action);
      try {
        const res = await gradeFlashcard({ cardId: card.id, grade: g });
        if (!res.ok) throw new Error(res.error);
        startTransition(() => {
          setQueue((q) => applyGrade(q, action));
          setReviewed((n) => n + 1);
        });
      } catch {
        toast({ tone: "error", title: "Grade not saved", description: "Check your connection and try again." });
      }
    });
  }

  // Keyboard: Space/Enter flips, 1–4 grades.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!flipped && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setFlipped(true);
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        grade(GRADES[Number(e.key) - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (totalCards === 0) {
    return (
      <EmptyState
        icon={<Icon name="layer" size={24} />}
        title="No flashcards yet"
        description="Flashcards are made from the files you upload to this Space."
        action={
          <Link href={`/spaces/${spaceId}`} className="text-sm font-semibold text-fg underline underline-offset-2">
            Go to documents
          </Link>
        }
      />
    );
  }

  if (!card) {
    const next = nextDueAt
      ? new Intl.DateTimeFormat("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(nextDueAt))
      : null;
    return (
      <EmptyState
        icon={<Icon name="layer" size={24} />}
        title={reviewed > 0 ? `Session complete · ${reviewed} card${reviewed === 1 ? "" : "s"} reviewed` : "Nothing due right now"}
        description={next ? `Next card due ${next}.` : "Come back later for your next review."}
      />
    );
  }

  const total = reviewed + shown.length;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 text-xs text-fg-subtle">
          <span>
            {reviewed + 1} of {total}
          </span>
          <span>{shown.length} left</span>
        </div>
        <Progress label="Review progress" value={Math.round((reviewed / total) * 100)} />
      </div>

      <Card
        key={card.id}
        className="flex min-h-[16rem] animate-fade-in flex-col gap-5 px-5 py-6 sm:min-h-[18rem] sm:px-8 sm:py-8"
      >
        <p className="text-eyebrow font-semibold tracking-wide text-fg-subtle uppercase">Question</p>
        <p dir="auto" className="text-lg leading-relaxed font-semibold wrap-break-word text-fg sm:text-xl">
          {card.front}
        </p>
        {flipped && (
          <div className="flex animate-fade-in flex-col gap-3 border-t border-border pt-5">
            <p className="text-eyebrow font-semibold tracking-wide text-fg-subtle uppercase">Answer</p>
            <p dir="auto" className="text-[0.9375rem] leading-relaxed wrap-break-word text-fg-body">
              {card.back}
            </p>
            <SourceLink spaceId={spaceId} source={card.source} />
          </div>
        )}
      </Card>

      {!flipped ? (
        <Button variant="primary" size="lg" className="w-full" onClick={() => setFlipped(true)}>
          Show answer
        </Button>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="How well did you know it?">
          {GRADES.map((g, i) => (
            <button
              key={g}
              type="button"
              onClick={() => grade(g)}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-control px-3 py-2 text-sm font-semibold transition-colors",
                gradeStyle[g],
              )}
            >
              {gradeLabel[g]}
              <span className="text-[0.6875rem] font-medium opacity-80">
                {formatDueIn(schedule(card, g).dueIn)}
                <span className="sr-only">, key {i + 1}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="hidden text-center text-xs text-fg-subtle lg:block">
        Space to show the answer · 1–4 to grade
      </p>
    </div>
  );
}
