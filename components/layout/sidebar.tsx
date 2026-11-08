import { cn } from "@/lib/cn";
import { SelectMenu } from "@/components/ui/select-menu";
import Link from "next/link";
import type { ReactNode } from "react";
import { NavItem } from "./nav-item";

export type SidebarNavLink = { href: string; label: string; icon?: ReactNode };
export type SidebarSpace = { id: string; href: string; name: string };

type SidebarProps = {
  logo: ReactNode;
  switcher?: ReactNode;
  menuLabel: string;
  nav: SidebarNavLink[];
  spacesLabel: string;
  spaces?: SidebarSpace[];
  /** Replaces the default space list (e.g. a client list with optimistic items). */
  spacesContent?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/**
 * Sidebar content (reference: sidebar). Colours are sampled from the
 * reference and live in the `sidebar-*` tokens. Rendered in the desktop rail
 * and inside the mobile drawer.
 */
export function Sidebar({
  logo,
  switcher,
  menuLabel,
  nav,
  spacesLabel,
  spaces = [],
  spacesContent,
  footer,
  className,
}: SidebarProps) {
  return (
    <div className={cn("flex h-full flex-col overflow-y-auto overscroll-contain bg-bg-sidebar px-3.5 pt-4 pb-6 [scrollbar-width:none] *:shrink-0", className)}>
      <div className="flex h-12 items-center justify-center">{logo}</div>
      {switcher && <div className="mt-3.5">{switcher}</div>}

      <nav aria-label={menuLabel} className="mt-8">
        <p className="mb-4 px-0.5 text-[0.9375rem] font-bold text-sidebar-label">{menuLabel}</p>
        <ul className="flex flex-col gap-1">
          {nav.map((item) => (
            <li key={item.href}>
              <NavItem href={item.href} label={item.label} icon={item.icon} />
            </li>
          ))}
        </ul>
      </nav>

      <hr className="mx-1.5 mt-6 border-0 border-t border-sidebar-line" />

      <div className="mt-8 flex flex-col">
        <p className="mb-4 px-0.5 text-[0.9375rem] font-bold text-sidebar-label">{spacesLabel}</p>
        {spacesContent ?? <SidebarSpaceList spaces={spaces} />}
      </div>

      <hr className="mx-1.5 mt-2 border-0 border-t border-sidebar-line" />

      {footer && <div className="mt-5">{footer}</div>}
    </div>
  );
}

/** The reference's space list: fades out at the bottom. */
export function SidebarSpaceList({
  spaces,
}: {
  spaces: (SidebarSpace & { pending?: boolean })[];
}) {
  return (
    <ul className="flex max-h-[8.5rem] flex-col gap-2.5 overflow-y-auto pb-6 [mask-image:linear-gradient(to_bottom,black_calc(100%-3rem),transparent)]">
      {spaces.map((s) => (
        <li key={s.id}>
          <Link
            href={s.href}
            aria-disabled={s.pending || undefined}
            className={cn(
              "flex min-h-11 items-center gap-2.5 rounded-control px-1 text-[0.9375rem] font-medium text-sidebar-fg transition-colors hover:text-sidebar-fg-active lg:min-h-0",
              s.pending && "pointer-events-none opacity-60",
            )}
          >
            <SidebarChip name={s.name} />
            <span dir="auto" className="wrap-anywhere">
              {s.name}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Grey letter chip with the reference's top-to-bottom gradient. */
function SidebarChip({ name, small }: { name: string; small?: boolean }) {
  const letter = Array.from(name.trim())[0]?.toUpperCase() ?? "?";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md bg-linear-to-b from-sidebar-chip-from to-sidebar-chip-to font-bold text-sidebar-chip-fg",
        small ? "size-6 text-[0.6875rem]" : "size-7.5 text-xs",
      )}
    >
      {letter}
    </span>
  );
}

type SidebarSwitcherProps = {
  label: string;
  placeholder: string;
  value: string;
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
  className?: string;
};

/** "Emmanuel's Workspace" switcher: hairline border, dim text, dim chevrons. */
export function SidebarSwitcher({ options, className, ...props }: SidebarSwitcherProps) {
  return (
    <SelectMenu
      {...props}
      className={className}
      options={options.map((o) => ({ ...o, leading: <SidebarChip name={o.label} small /> }))}
      triggerClassName="min-h-11 rounded-lg border border-[#161616] bg-bg-sidebar py-2 ps-2.5 pe-2.5 text-[0.8125rem] font-medium text-sidebar-switcher transition-colors hover:border-sidebar-line focus-visible:border-sidebar-active focus-visible:outline-none aria-expanded:border-sidebar-line lg:min-h-10"
    />
  );
}
