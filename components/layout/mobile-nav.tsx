"use client";

import { IconButton } from "@/components/ui/icon-button";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Menu button + off-canvas drawer holding the sidebar on screens below `lg`. */
export function MobileNav({
  children,
  openLabel,
  closeLabel,
}: {
  children: ReactNode;
  openLabel: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <>
      <IconButton label={openLabel} onClick={() => setOpen(true)} className="lg:hidden">
        <Menu className="size-5" />
      </IconButton>
      <dialog
        ref={ref}
        aria-label={openLabel}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          // Backdrop click or a navigation link closes the drawer.
          if (e.target === e.currentTarget || (e.target as HTMLElement).closest("a")) {
            setOpen(false);
          }
        }}
        className="fixed inset-y-0 start-0 end-auto m-0 h-dvh max-h-none w-72 max-w-[85vw] border-e border-border bg-bg-sidebar p-0 backdrop:bg-black/70 open:animate-drawer-in rtl:open:animate-drawer-in-rtl lg:hidden"
      >
        <div className="relative h-full">
          <IconButton label={closeLabel} onClick={() => setOpen(false)} className="absolute end-3 top-3 z-10">
            <X className="size-5" />
          </IconButton>
          {children}
        </div>
      </dialog>
    </>
  );
}
