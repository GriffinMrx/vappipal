"use client";

import { cn } from "@/lib/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

type NavItemProps = {
  href: string;
  label: string;
  icon?: ReactNode;
  /** Force the active state (otherwise derived from the URL). */
  active?: boolean;
  /** Match nested routes too (e.g. /spaces/123). */
  matchPrefix?: boolean;
};

/**
 * Sidebar link. Reading the pathname suspends on routes with unknown dynamic
 * params (e.g. /spaces/[id]), so the active-state part sits in its own
 * Suspense: the same link renders without highlight until the URL is known,
 * and the rest of the layout stays in the static shell.
 */
export function NavItem(props: NavItemProps) {
  return (
    <Suspense fallback={<NavLink {...props} isActive={props.active ?? false} />}>
      <ActiveNavLink {...props} />
    </Suspense>
  );
}

function ActiveNavLink({ active, matchPrefix = true, ...props }: NavItemProps) {
  const pathname = usePathname();
  const isActive =
    active ?? (pathname === props.href || (matchPrefix && props.href !== "/" && pathname.startsWith(`${props.href}/`)));
  return <NavLink {...props} isActive={isActive} />;
}

function NavLink({ href, label, icon, isActive }: NavItemProps & { isActive: boolean }) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group flex h-11 items-center gap-2.5 rounded-control px-2 text-[0.9375rem] font-medium transition-colors lg:h-8",
        isActive
          ? "bg-sidebar-active text-sidebar-fg-active"
          : "text-sidebar-fg hover:text-sidebar-fg-active",
      )}
    >
      {icon && (
        <span
          className={cn(
            "transition-colors",
            isActive ? "text-sidebar-icon-active" : "text-sidebar-icon group-hover:text-sidebar-fg-active",
          )}
        >
          {icon}
        </span>
      )}
      <span className="truncate">{label}</span>
    </Link>
  );
}
