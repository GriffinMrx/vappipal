"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Classes that reset the browser's default [popover] box so we can place it. */
export const popoverClasses =
  "fixed inset-auto m-0 overflow-y-auto rounded-card border border-border bg-surface p-0 text-fg-body shadow-[0_16px_40px_rgb(0_0_0/0.55)] open:animate-fade-in";

const GAP = 6;
const PAD = 8;

/**
 * Shared logic for the custom dropdowns. Uses the native `popover` attribute,
 * so menus render in the top layer: above modal dialogs and never clipped by
 * a scrolling sidebar. Gives light dismiss (outside click, Esc) for free.
 */
export function usePopover<T extends HTMLElement = HTMLButtonElement>({
  matchWidth = false,
  onOpen,
}: { matchWidth?: boolean; onOpen?: () => void } = {}) {
  const triggerRef = useRef<T>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Was the menu open when the pointer went down on the trigger? Light dismiss
  // closes it before the click, so the click must not reopen it.
  const openOnPointerDown = useRef(false);

  const place = useCallback(() => {
    const t = triggerRef.current;
    const p = popoverRef.current;
    if (!t || !p) return;
    const r = t.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    p.style.maxHeight = "";
    if (matchWidth) p.style.minWidth = `${r.width}px`;
    const pw = p.offsetWidth;
    const ph = p.offsetHeight;
    const below = vh - r.bottom - GAP - PAD;
    const above = r.top - GAP - PAD;
    const left = Math.max(PAD, Math.min(r.left, vw - pw - PAD));
    let top: number;
    if (ph <= below) top = r.bottom + GAP;
    else if (ph <= above) top = r.top - GAP - ph;
    else if (ph <= vh - 2 * PAD) top = vh - PAD - ph; // fits on screen: overlap the trigger rather than scroll
    else {
      top = PAD;
      p.style.maxHeight = `${vh - 2 * PAD}px`;
    }
    p.style.left = `${left}px`;
    p.style.top = `${top}px`;
  }, [matchWidth]);

  const isShown = () => popoverRef.current?.matches(":popover-open") ?? false;

  const show = useCallback(() => {
    const p = popoverRef.current;
    if (!p || p.matches(":popover-open")) return;
    onOpen?.();
    p.showPopover();
    place();
  }, [onOpen, place]);

  const hide = useCallback((refocus = true) => {
    const p = popoverRef.current;
    if (p?.matches(":popover-open")) p.hidePopover();
    if (refocus) triggerRef.current?.focus();
  }, []);

  // Mirror the real state (light dismiss closes without telling React).
  useEffect(() => {
    const p = popoverRef.current;
    if (!p) return;
    const onToggle = (e: Event) => {
      const isOpen = (e as ToggleEvent).newState === "open";
      setOpen(isOpen);
      if (!isOpen && (p.contains(document.activeElement) || document.activeElement === document.body)) {
        triggerRef.current?.focus();
      }
    };
    p.addEventListener("toggle", onToggle);
    return () => p.removeEventListener("toggle", onToggle);
  }, []);

  // Close when the page scrolls or resizes, so the menu never floats away.
  useEffect(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && popoverRef.current?.contains(e.target)) return;
      hide(false);
    };
    const onResize = () => hide(false);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, hide]);

  const triggerProps = {
    ref: triggerRef,
    "aria-expanded": open,
    onPointerDown: () => {
      openOnPointerDown.current = isShown();
    },
    onClick: () => {
      const wasOpen = openOnPointerDown.current;
      openOnPointerDown.current = false;
      if (wasOpen || isShown()) hide(false);
      else show();
    },
  };

  return { open, show, hide, triggerRef, popoverRef, triggerProps };
}
