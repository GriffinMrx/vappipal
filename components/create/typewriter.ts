// Plain module (no "use client" needed): reveals streamed text at a calm,
// steady pace, so the user can watch Vappi write (and the pal at work)
// instead of the text arriving in bursts.

import type { Pace } from "@/lib/settings/writing-speed";

/** Default pace (Settings → Normal): characters per second, and catch up within this many seconds when far behind. */
const NORMAL: Pace = { cps: 45, catchUpS: 25 };
const TICK_MS = 50;

export type Typewriter = {
  /** More text arrived from the stream. */
  push: (text: string) => void;
  /** The full text is known: reveal the rest, then resolve. */
  finish: (full?: string) => Promise<void>;
  /** Stop now (keeps what's revealed); returns it. */
  stop: () => string;
};

/**
 * `onReveal(shown, done)` gets the text revealed so far, about every 50 ms,
 * cut at a word boundary where possible so words don't flicker in half.
 */
export function createTypewriter(onReveal: (shown: string, done: boolean) => void, pace: Pace | (() => Pace) = NORMAL): Typewriter {
  /** Read on every tick, so a speed change applies even while typing. */
  const paceNow = () => (typeof pace === "function" ? pace() : pace);
  let target = "";
  let shown = 0;
  let finished = false;
  let stopped = false;
  let resolveDone: (() => void) | null = null;
  let last = performance.now();
  let carry = 0;

  const tick = () => {
    if (stopped) return;
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    const backlog = target.length - shown;
    const p = paceNow();
    if (backlog > 0 && !Number.isFinite(p.cps)) {
      shown = target.length;
      onReveal(target, false);
    } else if (backlog > 0) {
      const cps = Math.max(p.cps, backlog / p.catchUpS);
      carry += cps * dt;
      if (carry >= 1) {
        let next = Math.min(target.length, shown + Math.floor(carry));
        // Finish the word in progress (up to 12 more characters), unless we're at the end.
        if (next < target.length) {
          const m = target.slice(next, next + 12).search(/\s/);
          if (m > 0) next += m;
        }
        // Everything shown counts against the pace (the word's tail delays the next tick).
        carry -= next - shown;
        shown = next;
        onReveal(target.slice(0, shown), false);
      }
    } else carry = 0;
    if (finished && shown >= target.length) {
      clearInterval(timer);
      onReveal(target, true);
      resolveDone?.();
    }
  };
  const timer = setInterval(tick, TICK_MS);

  return {
    push(text) {
      target += text;
    },
    finish(full) {
      if (full !== undefined && full.startsWith(target.slice(0, shown))) target = full;
      finished = true;
      return new Promise<void>((r) => {
        resolveDone = r;
        tick();
      });
    },
    stop() {
      stopped = true;
      clearInterval(timer);
      resolveDone?.();
      return target.slice(0, shown);
    },
  };
}
