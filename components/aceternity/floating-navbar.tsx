"use client";

import { cn } from "@/lib/cn";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Floating Navbar, adapted from Aceternity UI (ui.aceternity.com/components/floating-navbar):
 * a blurred pill pinned to the top that slides away while scrolling down and
 * comes back on scroll up. Below md the links move into a menu panel.
 */
export function FloatingNavbar({
  logo,
  links,
  actions,
  menuActions,
}: {
  logo: ReactNode;
  links: { href: string; label: string }[];
  actions: ReactNode;
  /** Extra buttons shown at the bottom of the mobile menu. */
  menuActions?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(y > 8);
    setHidden(!open && y > 120 && y > prev);
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <motion.header
      className="fixed inset-x-0 top-3 z-50 px-3 sm:top-4 sm:px-4"
      initial={false}
      animate={{ y: hidden ? -110 : 0, opacity: hidden ? 0 : 1 }}
      transition={{ duration: reduce ? 0 : 0.22, ease: "easeOut" }}
    >
      <nav
        aria-label="Main"
        className={cn(
          "mx-auto flex w-full max-w-5xl items-center justify-between gap-3 rounded-[1.25rem] border py-2 ps-4 pe-2 backdrop-blur-md transition-colors",
          scrolled || open ? "border-border-strong bg-bg/80" : "border-border bg-bg/40",
        )}
      >
        <div className="flex min-w-0 items-center">{logo}</div>

        <ul className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="inline-flex h-11 items-center rounded-control px-3 text-sm font-medium text-fg-muted transition-colors hover:bg-surface hover:text-fg lg:h-9"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="landing-menu"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex size-11 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-surface hover:text-fg md:hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="landing-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: reduce ? 0 : 0.16 }}
            className="mx-auto mt-2 w-full max-w-5xl rounded-[1.25rem] border border-border-strong bg-bg/95 p-2 backdrop-blur-md md:hidden"
          >
            <ul className="flex flex-col">
              {links.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex h-12 items-center rounded-control px-3 text-base font-medium text-fg-body hover:bg-surface hover:text-fg"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
            {menuActions && <div className="mt-2 border-t border-border p-2 pt-3">{menuActions}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
