"use client";

import { useSyncExternalStore } from "react";
import { WRITING_SPEED_KEYS, type WritingSpeed } from "@/lib/settings/writing-speed";

/**
 * The writing speed as this browser knows it right now: set the moment it's
 * picked in Settings (optimistic), shared with open tabs through localStorage.
 * The server value stays the source of truth; a stored value is only used
 * when it's newer than what the server said (see useWritingSpeed).
 */
const KEY = "vappi.writingSpeed";
type Stored = { speed: WritingSpeed; at: number } | null;

let cache: Stored | undefined;
const listeners = new Set<() => void>();

function read(): Stored {
  if (cache !== undefined) return cache;
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Stored;
    cache = v && WRITING_SPEED_KEYS.includes(v.speed) && typeof v.at === "number" ? v : null;
  } catch {
    cache = null;
  }
  return cache;
}

function emit() {
  for (const l of listeners) l();
}

export const writingSpeedStore = {
  get: read,
  set(speed: WritingSpeed) {
    cache = { speed, at: Date.now() };
    try {
      window.localStorage.setItem(KEY, JSON.stringify(cache));
    } catch {
      /* storage blocked: this tab still updates */
    }
    emit();
  },
  /** The server reported this speed (it's the truth): store it if this browser thinks otherwise. */
  adopt(speed: WritingSpeed) {
    if (read()?.speed !== speed) this.set(speed);
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    // Another tab changed it.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      cache = undefined;
      listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },
};

/** The speed to use now: this browser's latest choice if it's newer than the server's value. */
export function useWritingSpeed(server: WritingSpeed, serverAt: number): WritingSpeed {
  const local = useSyncExternalStore(writingSpeedStore.subscribe, writingSpeedStore.get, () => null);
  return local && local.at > serverAt ? local.speed : server;
}
