"use client";

import { AiIcon } from "@/components/ui/ai-icon";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "vappi.chat.open";
const WIDE = "(min-width: 1280px)";

type ChatPanelState = {
  open: boolean;
  expanded: boolean;
  /** Docked beside the content (wide screens) vs full screen (narrow). */
  docked: boolean;
  setOpen: (open: boolean) => void;
  setExpanded: (expanded: boolean) => void;
};

const Ctx = createContext<ChatPanelState | null>(null);

export function useChatPanel() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useChatPanel must be used inside <ChatPanelLayout>");
  return ctx;
}

/**
 * Space page layout with the Space chat (Ask) docked on the right (≥1280px),
 * or full screen on smaller screens. Open/closed is remembered per browser;
 * wide screens open it by default the first time.
 */
export function ChatPanelLayout({
  children,
  chat,
  initiallyOpen,
}: {
  children: ReactNode;
  chat: ReactNode;
  /** Old ?tab=chat links open the panel. */
  initiallyOpen?: boolean;
}) {
  const [open, setOpenState] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [docked, setDocked] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    const sync = () => setDocked(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // Reading browser-only state after hydration (no SSR equivalent).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenState(initiallyOpen || (stored === null ? mq.matches : stored === "1"));
    return () => mq.removeEventListener("change", sync);
  }, [initiallyOpen]);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    if (!next) setExpanded(false);
    // Only remember the choice where the panel docks (full screen on phones is a one-off).
    if (window.matchMedia(WIDE).matches) window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  }, []);

  // Esc collapses the expanded view, then closes the full-screen (narrow) one.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector("dialog[open]")) return; // the dialog handles its own Esc
      if (expanded) setExpanded(false);
      else if (!docked) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, expanded, docked, setOpen]);

  // Full-screen chat: don't scroll the page underneath.
  const covering = open && (expanded || !docked);
  useEffect(() => {
    if (!covering) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [covering]);

  const value = useMemo(() => ({ open, expanded, docked, setOpen, setExpanded }), [open, expanded, docked, setOpen]);
  const dockedOpen = open && docked;

  return (
    <Ctx.Provider value={value}>
      <div className={cn(dockedOpen && "grid grid-cols-[minmax(0,1fr)_25rem] gap-6 2xl:grid-cols-[minmax(0,1fr)_27rem]")}>
        <div className="min-w-0">{children}</div>
        {/* Always mounted (hidden when closed) so closing never loses the conversation or a draft. */}
        <aside
          aria-label="Ask your files"
          hidden={!open}
          className={cn(
            covering
              ? "fixed inset-0 z-50 bg-bg lg:start-sidebar"
              : // Fits the space under the sticky topbar, so the input is always on screen
                // and only the messages scroll (never the whole page).
                "sticky top-[calc(var(--spacing-topbar)+0.5rem)] mt-2 h-[calc(100dvh-var(--spacing-topbar)-1rem)] min-h-80 self-start",
          )}
        >
          {chat}
        </aside>
      </div>
    </Ctx.Provider>
  );
}

/** "Chat" key in the space header: toggles the panel. */
export function ChatToggleButton() {
  const { open, setOpen } = useChatPanel();
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-pressed={open}
      className={buttonClasses({ variant: "accent", size: "md" })}
    >
      <AiIcon />
      Chat
    </button>
  );
}
