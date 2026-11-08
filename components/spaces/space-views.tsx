"use client";

import { Icon } from "@/components/icons/icon";
import { SidebarSpaceList, SidebarSwitcher } from "@/components/layout/sidebar";
import { SpaceCard } from "@/components/study/space-card";
import { Button } from "@/components/ui/button";
import { ProFeatureCard } from "@/components/layout/pro-feature-card";
import { PlanProvider } from "@/components/planner/plan-provider";
import { TodayPlan } from "@/components/planner/today-plan";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDay, uiColor } from "@/lib/spaces/format";
import { goalName } from "@/lib/spaces/goal";
import type { TodayTask } from "@/lib/planner/types";
import type { SpaceView } from "@/lib/spaces/types";
import { Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMergedSpaces, useSpacesContext } from "./spaces-provider";


function spaceMeta(s: SpaceView) {
  const docs = s.documentCount === 1 ? "1 document" : `${s.documentCount} documents`;
  return `${docs} · ${s.goalDate ? `${goalName(s.goalLabel)} ${formatDay(s.goalDate)}` : "No goal date"}`;
}

/** Live (optimistic) space list for the sidebar. */
export function SidebarSpacesLive({ spaces }: { spaces: SpaceView[] }) {
  const all = useMergedSpaces(spaces);
  return (
    <SidebarSpaceList
      spaces={all.map((s) => ({ id: s.id, name: s.name, href: `/spaces/${s.id}`, pending: s.pending }))}
    />
  );
}

/** Sidebar switcher: jumps to a space. Hidden when there are none. */
export function SpaceSwitcher({ spaces }: { spaces: SpaceView[] }) {
  const router = useRouter();
  const pathname = usePathname();
  if (spaces.length === 0) return null;
  const current = spaces.find((s) => pathname.startsWith(`/spaces/${s.id}`))?.id ?? "";
  return (
    <SidebarSwitcher
      label="Open a Space"
      placeholder="Open a Space…"
      value={current}
      onSelect={(id) => router.push(`/spaces/${id}`)}
      options={spaces.map((s) => ({ value: s.id, label: s.name }))}
    />
  );
}

/** Opens the create dialog. */
export function NewSpaceButton({
  variant = "secondary",
  compact,
}: {
  variant?: "secondary" | "accent";
  compact?: boolean;
}) {
  const { openCreate } = useSpacesContext();
  if (compact) {
    return (
      <Button variant={variant} size="sm" className="min-w-11" icon={<Plus className="size-4" strokeWidth={2.5} />} onClick={openCreate}>
        <span className="sr-only">New Space</span>
      </Button>
    );
  }
  return variant === "accent" ? (
    <Button variant="accent" size="lg" icon={<Icon name="folder" size={18} />} onClick={openCreate}>
      Create a Space
    </Button>
  ) : (
    <Button variant="secondary" icon={<Plus className="size-4" strokeWidth={2.5} />} onClick={openCreate}>
      New Space
    </Button>
  );
}

/** Spaces row on Home (or the empty state). */
export function HomeSpaces({ spaces }: { spaces: SpaceView[] }) {
  const { openCreate } = useSpacesContext();
  const all = useMergedSpaces(spaces);
  if (all.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="folder-library" size={24} />}
        title="Create your first space"
        description="A Space groups your files about one topic, like “Biology”, “My business plan” or “Cooking”."
        action={
          <Button variant="accent" icon={<Icon name="folder" size={18} />} onClick={openCreate}>
            Create a Space
          </Button>
        }
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:flex 2xl:flex-wrap">
      {all.map((s) => (
        <SpaceCard
          key={s.id}
          href={`/spaces/${s.id}`}
          name={s.name}
          color={uiColor(s.color)}
          meta={spaceMeta(s)}
          icon={<Icon name="folder" size={22} />}
          pending={s.pending}
          className="2xl:w-[14.5rem]"
        />
      ))}
    </div>
  );
}

/** Home "Today's plan": today's tasks (Pro), or the right empty state. */
export function HomePlan({
  spaces,
  tasks,
  pro,
}: {
  spaces: SpaceView[];
  tasks: TodayTask[];
  pro: boolean;
}) {
  const hasGoal = useMergedSpaces(spaces).some((s) => s.goalDate);
  if (pro && tasks.length > 0) {
    return (
      <PlanProvider>
        <Card className="px-2 py-1 sm:px-3">
          <TodayPlan tasks={tasks} limit={6} moreHref="/planner" />
        </Card>
      </PlanProvider>
    );
  }
  if (!pro && hasGoal) {
    return (
      <ProFeatureCard
        title="Get a daily plan to your goal"
        description="The planner is a Pro feature: what to read, which cards to review and when to take a quiz, every day until your goal date."
      />
    );
  }
  return (
    <EmptyState
      icon={<Icon name="planner" size={24} />}
      title={hasGoal ? "Nothing planned today" : "No goal date yet"}
      description={
        hasGoal
          ? "Enjoy the rest day, or review a few flashcards."
          : "Add a goal date to a Space (an exam, a presentation, a deadline…) and Vappi will plan each day until then."
      }
    />
  );
}
