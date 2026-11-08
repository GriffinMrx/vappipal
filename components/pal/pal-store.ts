"use client";

import { useSyncExternalStore } from "react";
import type { PalMood } from "./vappi-pal";

/**
 * What the AI is doing right now, app-wide, so the pal next to the logo can
 * mirror the chat. Tiny external store: no context, no re-render of the tree.
 */
let mood: PalMood = "idle";
/** Bumps on every change, so "asleep since version N" goes stale when the AI acts. */
let version = 0;
let revert: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const palStore = {
  get: () => mood,
  /** Set the mood; with `forMs`, go back to idle afterwards (e.g. happy for a moment). */
  set(next: PalMood, forMs?: number) {
    clearTimeout(revert);
    if (mood !== next) {
      mood = next;
      version++;
      emit();
    }
    if (forMs) revert = setTimeout(() => palStore.set("idle"), forMs);
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function usePalMood(): PalMood {
  return useSyncExternalStore(palStore.subscribe, palStore.get, () => "idle");
}

/** Changes whenever the mood changes (used to reset the logo pal's sleep timer). */
export function usePalVersion(): number {
  return useSyncExternalStore(palStore.subscribe, () => version, () => 0);
}
