"use client";

import { Icon } from "@/components/icons/icon";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { answerQuestion, startQuiz, type AnswerResult } from "@/lib/study/actions";
import type { QuizQuestion } from "@/lib/study/queries";
import { Check, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SourceLink } from "./source-link";

type QuizInfo = { questions: number; limit: number | null; used: number; pro: boolean; allowed: boolean };
type Answered = Extract<AnswerResult, { ok: true }> & { given: string };

function LimitCard({ limit, used }: { limit: number; used: number }) {
  return (
    <Card className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-bold text-fg">
          You&apos;ve used {used} of {limit} free quizzes this week
        </p>
        <p className="text-xs text-fg-muted">Upgrade to Pro for unlimited quizzes, or come back when your week resets.</p>
      </div>
      <Link href="/billing" className={buttonClasses({ variant: "accent", size: "md", className: "shrink-0" })}>
        Upgrade
      </Link>
    </Card>
  );
}

/** Start screen + one question at a time + score (AGENTS.md §11). */
export function QuizRunner({
  spaceId,
  info,
  token,
  questions,
}: {
  spaceId: string;
  info: QuizInfo;
  /** Present while a quiz started by the server is running. */
  token: string | null;
  questions: QuizQuestion[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [limitHit, setLimitHit] = useState<{ limit: number; used: number } | null>(null);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState("");
  const [text, setText] = useState("");
  const [results, setResults] = useState<Record<string, Answered>>({});
  const [finished, setFinished] = useState(false);

  function begin() {
    startTransition(async () => {
      try {
        const res = await startQuiz({ spaceId });
        if (res.ok) {
          setIndex(0);
          setResults({});
          setFinished(false);
          setChoice("");
          setText("");
          router.push(`/spaces/${spaceId}?tab=quiz&t=${encodeURIComponent(res.token)}`, { scroll: false });
        } else if ("limitReached" in res) setLimitHit(res.limitReached);
        else toast({ tone: "error", title: "Couldn't start the quiz", description: res.error });
      } catch {
        toast({ tone: "error", title: "Couldn't start the quiz", description: "Check your connection and try again." });
      }
    });
  }

  // ── Start screen ────────────────────────────────────────────────
  if (!token || questions.length === 0) {
    if (info.questions === 0) {
      return (
        <EmptyState
          icon={<Icon name="exam" size={24} />}
          title="No quiz questions yet"
          description="Questions are written from the files you upload to this Space."
          action={
            <Link href={`/spaces/${spaceId}`} className="text-sm font-semibold text-fg underline underline-offset-2">
              Go to documents
            </Link>
          }
        />
      );
    }
    const limit = limitHit ?? (!info.allowed && info.limit !== null ? { limit: info.limit, used: info.used } : null);
    const left = info.limit === null ? null : Math.max(0, info.limit - info.used);
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        {limit ? (
          <LimitCard {...limit} />
        ) : (
          <Card className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-card bg-surface-active text-fg-muted">
              <Icon name="exam" size={24} />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-base font-bold text-fg">Test yourself</p>
              <p className="text-sm text-fg-muted">
                {Math.min(10, info.questions)} questions from your {info.questions === 1 ? "question" : `${info.questions} questions`}, new and missed ones first.
              </p>
              {left !== null && (
                <p className="text-xs text-fg-subtle">
                  Free plan: {left} of {info.limit} quizzes left this week
                </p>
              )}
            </div>
            <Button variant="primary" size="lg" loading={pending} onClick={begin} className="w-full sm:w-auto">
              Start quiz
            </Button>
          </Card>
        )}
      </div>
    );
  }

  // ── Score ───────────────────────────────────────────────────────
  if (finished) {
    const answered = questions.filter((q) => results[q.id]);
    const score = answered.filter((q) => results[q.id].correct).length;
    const missed = answered.filter((q) => !results[q.id].correct);
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <Card className="flex flex-col items-center gap-2 px-6 py-8 text-center">
          <p className="text-eyebrow font-semibold tracking-wide text-fg-subtle uppercase">Your score</p>
          <p className="text-4xl font-bold text-fg">
            {score} / {answered.length}
          </p>
          <p className="text-sm text-fg-muted">
            {score === answered.length ? "Perfect — well done." : `${missed.length} to review.`}
          </p>
        </Card>
        {missed.length > 0 && (
          <Card className="flex flex-col gap-1 px-5 py-4">
            <p className="mb-2 text-sm font-bold text-fg">Questions to review</p>
            <ul className="flex flex-col divide-y divide-border">
              {missed.map((q) => (
                <li key={q.id} className="flex flex-col gap-1 py-3">
                  <p dir="auto" className="text-sm wrap-break-word text-fg-body">
                    {q.question}
                  </p>
                  <p className="text-xs text-fg-muted">
                    Answer: <span className="text-fg">{results[q.id].correctAnswer}</span>
                  </p>
                  <SourceLink spaceId={spaceId} source={q.source} />
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Button variant="primary" size="lg" loading={pending} onClick={begin} className="w-full sm:w-auto sm:self-center">
          New quiz
        </Button>
      </div>
    );
  }

  // ── Question ────────────────────────────────────────────────────
  const q = questions[index];
  const result = results[q.id];
  const given = q.type === "MULTIPLE_CHOICE" ? choice : text;

  function submit() {
    if (!given.trim()) return;
    startTransition(async () => {
      try {
        const res = await answerQuestion({ token: token!, questionId: q.id, answer: given });
        if (res.ok) setResults((r) => ({ ...r, [q.id]: { ...res, given } }));
        else toast({ tone: "error", title: "Couldn't check your answer", description: res.error });
      } catch {
        // Not optimistic: the typed answer stays, the user can retry.
        toast({ tone: "error", title: "Couldn't check your answer", description: "Check your connection and try again." });
      }
    });
  }

  function next() {
    setChoice("");
    setText("");
    if (index + 1 >= questions.length) setFinished(true);
    else setIndex(index + 1);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-fg-subtle">
          <span>
            Question {index + 1} of {questions.length}
          </span>
          <span>{q.type === "MULTIPLE_CHOICE" ? "Multiple choice" : "Short answer"}</span>
        </div>
        <Progress label="Quiz progress" value={Math.round((index / questions.length) * 100)} />
      </div>

      <Card key={q.id} className="flex animate-fade-in flex-col gap-5 px-5 py-6 sm:px-8 sm:py-8">
        <p dir="auto" className="text-lg leading-relaxed font-semibold wrap-break-word text-fg">
          {q.question}
        </p>

        {q.type === "MULTIPLE_CHOICE" ? (
          <div role="radiogroup" aria-label="Options" className="flex flex-col gap-2">
            {q.options.map((o) => {
              const isChoice = choice === o;
              const isAnswer = result && o === result.correctAnswer;
              const isWrongPick = result && isChoice && !result.correct;
              return (
                <button
                  key={o}
                  type="button"
                  role="radio"
                  aria-checked={isChoice}
                  disabled={!!result || pending}
                  onClick={() => setChoice(o)}
                  className={cn(
                    "flex min-h-12 w-full items-center gap-3 rounded-control border px-4 py-3 text-start text-sm transition-colors",
                    !result && (isChoice ? "border-fg-subtle bg-surface-active text-fg" : "border-border text-fg-body hover:border-border-strong hover:bg-surface-hover"),
                    isAnswer && "border-success/60 bg-success/10 text-fg",
                    isWrongPick && "border-danger/60 bg-danger/10 text-fg",
                    result && !isAnswer && !isWrongPick && "border-border text-fg-muted",
                  )}
                >
                  <span dir="auto" className="min-w-0 flex-1 wrap-break-word">
                    {o}
                  </span>
                  {isAnswer && <Check aria-label="Correct answer" className="size-4 shrink-0 text-success" />}
                  {isWrongPick && <X aria-label="Your answer" className="size-4 shrink-0 text-danger" />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`answer-${q.id}`} className="text-xs font-semibold text-fg-muted">
              Your answer
            </label>
            <textarea
              id={`answer-${q.id}`}
              dir="auto"
              rows={4}
              maxLength={2000}
              value={text}
              disabled={!!result}
              onChange={(e) => setText(e.target.value)}
              placeholder="Answer in your own words"
              className="w-full resize-y rounded-control border border-border bg-transparent px-3 py-2.5 text-sm text-fg placeholder:text-fg-subtle hover:border-border-strong focus:border-fg-subtle focus:outline-none disabled:opacity-70"
            />
          </div>
        )}

        {result && (
          <div
            role="status"
            className={cn(
              "flex animate-fade-in flex-col gap-2 rounded-control border px-4 py-3",
              result.correct ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10",
            )}
          >
            <p className={cn("flex items-center gap-2 text-sm font-bold", result.correct ? "text-success" : "text-danger")}>
              {result.correct ? <Check className="size-4" /> : <X className="size-4" />}
              {result.correct ? "Correct" : "Not quite"}
            </p>
            {result.feedback && <p className="text-sm text-fg-body">{result.feedback}</p>}
            {(!result.correct || q.type === "SHORT_ANSWER") && (
              <p className="text-sm text-fg-body">
                <span className="text-fg-muted">From your files: </span>
                <span dir="auto" className="wrap-break-word text-fg">
                  {result.correctAnswer}
                </span>
              </p>
            )}
            <p dir="auto" className="text-xs leading-relaxed wrap-break-word text-fg-muted">
              {result.explanation}
            </p>
            <SourceLink spaceId={spaceId} source={q.source} />
          </div>
        )}
      </Card>

      {!result ? (
        <Button variant="primary" size="lg" className="w-full" loading={pending} disabled={!given.trim()} onClick={submit}>
          Check answer
        </Button>
      ) : (
        <Button variant="primary" size="lg" className="w-full" onClick={next}>
          {index + 1 >= questions.length ? "See score" : "Next question"}
        </Button>
      )}
    </div>
  );
}
