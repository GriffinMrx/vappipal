import { Icon } from "@/components/icons/icon";
import { AppShell } from "@/components/layout/app-shell";
import { Logo } from "@/components/layout/logo";
import { Sidebar } from "@/components/layout/sidebar";
import { TimeZoneSync } from "@/components/layout/time-zone-sync";
import { UpgradeCard } from "@/components/layout/upgrade-card";
import {
  NewSpaceButton,
  SidebarSpacesLive,
  SpaceSwitcher,
} from "@/components/spaces/space-views";
import { LogoPal } from "@/components/pal/logo-pal";
import { SpacesProvider } from "@/components/spaces/spaces-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { hasProAccess } from "@/lib/billing/access";
import { getCurrentDbUser } from "@/lib/auth/current-user";
import { listSpaces } from "@/lib/spaces/queries";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

const nav = [
  { href: "/home", label: "Home", icon: <Icon name="home" size={20} /> },
  { href: "/spaces", label: "Spaces", icon: <Icon name="folder-library" size={20} /> },
  { href: "/planner", label: "Planner", icon: <Icon name="planner" size={20} /> },
  { href: "/billing", label: "Billing", icon: <Icon name="credit-card" size={20} /> },
  { href: "/settings", label: "Settings", icon: <Icon name="setting" size={20} /> },
];

/**
 * Shell for every signed-in page. Everything here is static (part of the
 * static shell, so navigations are instant); only the small user-dependent
 * islands below suspend, each with its own fallback. Pages have their own
 * loading.tsx so client navigations never wait on this layout.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const sidebar = (
    <Sidebar
      logo={
        <Link href="/home" aria-label="Vappi home" className="inline-flex min-h-11 items-center gap-2 rounded-md lg:min-h-0">
          <Logo height={32} />
          {/* Vappi's AI pal: mirrors what the AI is doing anywhere in the app. */}
          <LogoPal size={28} />
        </Link>
      }
      switcher={
        <Suspense fallback={null}>
          <SwitcherIsland />
        </Suspense>
      }
      menuLabel="Menu"
      nav={nav}
      spacesLabel="Spaces"
      spacesContent={
        <Suspense fallback={<SpaceListSkeleton />}>
          <SpaceListIsland />
        </Suspense>
      }
      footer={
        <Suspense fallback={null}>
          <UpgradeIsland />
        </Suspense>
      }
    />
  );

  return (
    <SpacesProvider>
      <AppShell
        sidebar={sidebar}
        openMenuLabel="Open menu"
        closeMenuLabel="Close menu"
        actions={
          <>
            <span className="hidden sm:inline-flex">
              <NewSpaceButton />
            </span>
            <span className="sm:hidden">
              <NewSpaceButton compact />
            </span>
            <span className="inline-flex size-11 items-center justify-center lg:size-9">
              <UserButton />
            </span>
          </>
        }
      >
        {children}
      </AppShell>
      <Suspense fallback={null}>
        <TimeZoneIsland />
      </Suspense>
    </SpacesProvider>
  );
}

// ─── User-dependent islands (each reads the request inside its own Suspense) ───

async function SpaceListIsland() {
  const user = await getCurrentDbUser();
  return <SidebarSpacesLive spaces={await listSpaces(user.id)} />;
}

async function SwitcherIsland() {
  const user = await getCurrentDbUser();
  return <SpaceSwitcher spaces={await listSpaces(user.id)} />;
}

async function UpgradeIsland() {
  const user = await getCurrentDbUser();
  // The one Pro check (AGENTS.md §7); User.plan is only a display cache.
  if (await hasProAccess(user.id)) return null;
  return (
    <UpgradeCard
      title="Upgrade to Pro"
      description="Unlimited uploads, Ask and Create, and the goal planner."
      cta="Upgrade"
      href="/billing"
    />
  );
}

async function TimeZoneIsland() {
  const user = await getCurrentDbUser();
  return <TimeZoneSync stored={user.timeZone} />;
}

function SpaceListSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 pb-6" aria-hidden>
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-2.5 px-1">
          <Skeleton className="size-7.5 rounded-md" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}
