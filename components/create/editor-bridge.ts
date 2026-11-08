"use client";

import { useSyncExternalStore } from "react";

/**
 * The open creation, as the side chat sees it. The Create editor publishes
 * itself here; the Space chat reads it, so one chat can both answer and
 * edit the document live. Tiny external store (like palStore).
 */

export type EditOutcome =
  | { kind: "edited"; scope: "selection" | "document"; reply: string }
  /** Nothing changed (Vappi explains why). */
  | { kind: "info"; reply: string }
  | { kind: "ask" }
  | { kind: "stopped" }
  | { kind: "error"; message: string };

/** A recent side-chat turn, sent with an edit so follow-ups ("yes", "both of them") make sense. */
export type EditHistoryItem = { role: "user" | "assistant"; content: string };

export type DocTarget = {
  id: string;
  title: string;
  /** A short preview of the selected text, or null (the whole document). */
  selection: string | null;
  busy: boolean;
  /**
   * `auto`: let the server decide edit vs question ("ask" → answer in chat).
   * `onWorking` runs once Vappi has actually started editing.
   * `history`: the latest chat turns (context only).
   */
  edit: (instruction: string, auto: boolean, onWorking?: () => void, history?: EditHistoryItem[]) => Promise<EditOutcome>;
  stop: () => void;
  /** The document as Markdown (context for questions). */
  markdown: () => string;
  clearSelection: () => void;
};

let target: DocTarget | null = null;
const listeners = new Set<() => void>();

export const editorBridge = {
  get: () => target,
  set(next: DocTarget | null) {
    target = next;
    for (const l of listeners) l();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useDocTarget(): DocTarget | null {
  return useSyncExternalStore(editorBridge.subscribe, editorBridge.get, () => null);
}
