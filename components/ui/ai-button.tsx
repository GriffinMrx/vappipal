"use client";

import { AiIcon } from "@/components/ui/ai-icon";
import { cn } from "@/lib/cn";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { buttonClasses, type ButtonSize } from "./button";

export type AiStatus = "idle" | "loading" | "done" | "error";

type AiButtonProps = {
  /** Runs the AI action. Clicking again while loading aborts `signal` (stop). */
  onClick: (e: MouseEvent<HTMLButtonElement>, ctx: { signal: AbortSignal }) => Promise<unknown> | void;
  children?: ReactNode;
  /** Shown while loading; several labels rotate. */
  loadingLabel?: string | string[];
  doneLabel?: string;
  errorLabel?: string;
  /** Control the state from outside (e.g. while a background job runs). */
  status?: AiStatus;
  size?: ButtonSize;
  iconOnly?: boolean;
  /** How long Done / Error stay before returning to idle (ms). */
  resetAfter?: number;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

const ROTATE_MS = 1600;

/**
 * Vappi's AI action button (original implementation). Accent purple key with
 * a sparkle: it turns and the label shimmers while working, a check draws in
 * when done, "Try again" on error. Announces each state to screen readers;
 * prefers-reduced-motion holds everything still.
 */
export function AiButton({
  onClick,
  children = "Generate",
  loadingLabel = "Generating",
  doneLabel = "Done",
  errorLabel = "Try again",
  status: controlled,
  size = "md",
  iconOnly,
  resetAfter = 1800,
  disabled,
  className,
  "aria-label": ariaLabel,
}: AiButtonProps) {
  const [internal, setInternal] = useState<AiStatus>("idle");
  const status = controlled ?? internal;
  const [labelIndex, setLabelIndex] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const labels = Array.isArray(loadingLabel) ? loadingLabel : [loadingLabel];

  // Rotate loading labels.
  useEffect(() => {
    if (status !== "loading" || labels.length < 2) return;
    const t = setInterval(() => setLabelIndex((i) => (i + 1) % labels.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [status, labels.length]);

  // Done / error fall back to idle.
  useEffect(() => {
    if (controlled !== undefined || (internal !== "done" && internal !== "error")) return;
    const t = setTimeout(() => setInternal("idle"), resetAfter);
    return () => clearTimeout(t);
  }, [internal, controlled, resetAfter]);

  useEffect(() => () => controller.current?.abort(), []);

  async function handleClick(e: MouseEvent<HTMLButtonElement>) {
    if (status === "loading") {
      controller.current?.abort(); // stop
      controller.current = null;
      if (controlled === undefined) setInternal("idle");
      return;
    }
    const c = new AbortController();
    controller.current = c;
    setLabelIndex(0);
    if (controlled === undefined) setInternal("loading");
    try {
      await onClick(e, { signal: c.signal });
      if (!c.signal.aborted && controlled === undefined) setInternal("done");
    } catch {
      if (!c.signal.aborted && controlled === undefined) setInternal("error");
    } finally {
      if (controller.current === c) controller.current = null;
    }
  }

  const text =
    status === "loading" ? labels[labelIndex % labels.length] : status === "done" ? doneLabel : status === "error" ? errorLabel : children;
  const announce =
    status === "loading" ? `${labels[0]}…` : status === "done" ? doneLabel : status === "error" ? "Failed. Try again." : "";

  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={status === "loading" || undefined}
      aria-label={ariaLabel ?? (iconOnly ? String(children) : undefined)}
      title={status === "loading" ? "Click to stop" : undefined}
      onClick={handleClick}
      className={cn(
        buttonClasses({ variant: "accent", size }),
        "group/ai relative overflow-hidden",
        iconOnly && "aspect-square px-0",
        className,
      )}
    >
      <span aria-hidden className="relative inline-flex size-4 shrink-0 items-center justify-center">
        {status === "done" ? (
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray="24" className="animate-ai-check motion-reduce:animate-none" />
          </svg>
        ) : (
          <AiIcon
            busy={status === "loading"}
            className="transition-transform duration-300 group-hover/ai:scale-110 motion-reduce:transform-none"
          />
        )}
      </span>
      {!iconOnly && (
        <span
          key={status === "loading" ? `l${labelIndex}` : status}
          className={cn(
            "animate-ai-label motion-reduce:animate-none",
            status === "loading" &&
              "animate-ai-shimmer bg-[linear-gradient(110deg,rgb(240_228_248/0.6)_35%,rgb(255_255_255)_50%,rgb(240_228_248/0.6)_65%)] bg-size-[200%_100%] bg-clip-text text-transparent motion-reduce:animate-none motion-reduce:bg-none motion-reduce:text-accent-fg",
          )}
        >
          {text}
          {status === "loading" && "…"}
        </span>
      )}
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>
    </button>
  );
}
