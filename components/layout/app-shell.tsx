import type { ReactNode } from "react";
import { MobileNav } from "./mobile-nav";
import { Topbar } from "./topbar";

type AppShellProps = {
  sidebar: ReactNode;
  search?: ReactNode;
  actions?: ReactNode;
  openMenuLabel: string;
  closeMenuLabel: string;
  children: ReactNode;
};

/**
 * Fixed sidebar rail on desktop (`lg+`), drawer below it.
 * Uses logical positioning so the rail moves to the right in RTL.
 */
export function AppShell({
  sidebar,
  search,
  actions,
  openMenuLabel,
  closeMenuLabel,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-dvh bg-bg">
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-sidebar lg:block">{sidebar}</aside>
      <div className="lg:ps-sidebar">
        <Topbar
          start={
            <MobileNav openLabel={openMenuLabel} closeLabel={closeMenuLabel}>
              {sidebar}
            </MobileNav>
          }
          search={search}
          actions={actions}
        />
        <main className="px-4 pb-16 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
