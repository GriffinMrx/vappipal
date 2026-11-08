import { Icon } from "@/components/icons/icon";
import { PageHeader } from "@/components/layout/page-header";
import { SectionHeader } from "@/components/layout/section-header";
import { PlanProvider } from "@/components/planner/plan-provider";
import { PlannerUpgrade } from "@/components/planner/planner-upgrade";
import { SpacePlanCard } from "@/components/planner/space-plan-card";
import { TodayPlan } from "@/components/planner/today-plan";
import { EditSpaceButton } from "@/components/spaces/space-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentDbUser } from "@/lib/auth/current-user";
import { hasProAccess } from "@/lib/billing/access";
import { dayInZone } from "@/lib/dates";
import type { SpaceColor } from "@/lib/generated/prisma/enums";
import { goalCountdown } from "@/lib/spaces/goal";
import { getPlans, todayTasks } from "@/lib/planner/queries";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Plan · Vappi" };

/** Plan: today's tasks across Spaces, then each Space's plan until its goal date. */
export default async function PlannerPage() {
  const user = await getCurrentDbUser();
  const pro = await hasProAccess(user.id);

  return (
    <>
      <PageHeader eyebrow="Plan" title="Plan to your goals" />
      <div className="mt-8">{pro ? <Planner userId={user.id} timeZone={user.timeZone} /> : <PlannerUpgrade />}</div>
    </>
  );
}

async function Planner({ userId, timeZone }: { userId: string; timeZone: string }) {
  const plans = await getPlans(userId, timeZone);
  const today = dayInZone(timeZone);
  const upcoming = plans.filter((p) => p.daysLeft !== null && p.daysLeft >= 0).sort((a, b) => a.daysLeft! - b.daysLeft!);
  const noDate = plans.filter((p) => p.daysLeft === null || p.daysLeft < 0);
  const tasks = todayTasks(upcoming, today);

  if (plans.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="planner" size={24} />}
        title="No Spaces yet"
        description="Create a Space, upload your files and add a goal date to get a daily plan."
      />
    );
  }

  return (
    <PlanProvider>
      <section>
        <SectionHeader icon={<Icon name="planner" size={22} />} title="Today" />
        <div className="mt-3.5">
          {tasks.length ? (
            <Card className="px-2 py-1 sm:px-3">
              <TodayPlan tasks={tasks} />
            </Card>
          ) : (
            <EmptyState
              title={upcoming.length ? "Nothing planned today" : "No goal date yet"}
              description={
                upcoming.length
                  ? "Enjoy the rest day, or review a few flashcards."
                  : "Add a goal date to a Space (an exam, a presentation, a deadline…) and Vappi will plan each day until then."
              }
            />
          )}
        </div>
      </section>

      {upcoming.length > 0 && (
        <section className="mt-10">
          <SectionHeader icon={<Icon name="exam" size={22} />} title="Until your goals" />
          <div className="mt-3.5 grid grid-cols-1 gap-4 xl:grid-cols-2">
            {upcoming.map((p) => (
              <SpacePlanCard key={p.spaceId} plan={p} today={today} />
            ))}
          </div>
        </section>
      )}

      {noDate.length > 0 && (
        <section className="mt-10">
          <SectionHeader icon={<Icon name="folder" size={22} />} title="No goal date" />
          <ul className="mt-3.5 flex flex-col gap-2">
            {noDate.map((p) => (
              <li key={p.spaceId}>
                <Card className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-bold text-fg wrap-anywhere">{p.spaceName}</span>
                    <span className="text-xs text-fg-subtle">{goalCountdown(p.daysLeft, p.goalLabel)}</span>
                  </span>
                  <EditSpaceButton
                    space={{ id: p.spaceId, name: p.spaceName, goalDate: p.goalDate, goalLabel: p.goalLabel, color: p.color as SpaceColor }}
                    label={p.daysLeft === null ? "Add goal date" : "Set a new date"}
                  />
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PlanProvider>
  );
}
