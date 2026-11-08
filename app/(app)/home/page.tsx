import { Icon } from "@/components/icons/icon";
import { PageHeader } from "@/components/layout/page-header";
import { SectionHeader } from "@/components/layout/section-header";
import { HomeStats } from "@/components/home/home-stats";
import { DocumentCard } from "@/components/study/document-card";
import {
  HomePlan,
  HomeSpaces,
  NewSpaceButton,
} from "@/components/spaces/space-views";
import { EmptyState } from "@/components/ui/empty-state";
import { firstName, getCurrentDbUser } from "@/lib/auth/current-user";
import { hasProAccess } from "@/lib/billing/access";
import { dayInZone, hourInZone } from "@/lib/dates";
import { getPlans, todayTasks } from "@/lib/planner/queries";
import { uiColor } from "@/lib/spaces/format";
import { getHomeData, listSpaces } from "@/lib/spaces/queries";
import { getHomeCharts } from "@/lib/home/activity";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Home · Vappi" };

const statusLabel = { PROCESSING: "Processing", READY: "Ready", FAILED: "Failed" } as const;
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export default async function HomePage() {
  const user = await getCurrentDbUser();
  const [spaces, { cardsDue, recentDocuments }, pro, charts] = await Promise.all([
    listSpaces(user.id),
    getHomeData(user.id, user.timeZone),
    hasProAccess(user.id),
    getHomeCharts(user.id, user.timeZone),
  ]);
  const plans = pro ? await getPlans(user.id, user.timeZone) : [];

  const today = dayInZone(user.timeZone);
  const planToday = todayTasks(plans, today);
  // Goal card (Pro): the plan's tasks per day from today to the goal.
  const goalPlans = Object.fromEntries(
    plans.map((p) => [
      p.spaceId,
      {
        series: p.days.filter((d) => d.day >= today).map((d) => ({ day: d.day, value: d.tasks.length })),
        done: p.doneTasks,
        total: p.totalTasks,
      },
    ]),
  );
  const hour = hourInZone(user.timeZone);
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: user.timeZone,
  }).format(new Date());

  return (
    <>
      <PageHeader
        eyebrow={dateLabel}
        title={`${greeting}, ${firstName(user)}`}
        actions={<NewSpaceButton variant="accent" />}
      />

      <section className="mt-8">
        <HomeStats spaces={spaces} today={today} cardsDue={cardsDue} charts={charts} goalPlans={goalPlans} pro={pro} />
      </section>

      <section className="mt-10">
        <SectionHeader
          icon={<Icon name="folder" size={22} />}
          title="Spaces"
          seeAllHref="/spaces"
          seeAllLabel="See all"
        />
        <div className="mt-3.5">
          <HomeSpaces spaces={spaces} />
        </div>
      </section>

      <section className="mt-6.5">
        <SectionHeader
          icon={<Icon name="planner" size={22} />}
          title="Today's plan"
          seeAllHref={pro ? "/planner" : undefined}
          seeAllLabel="Open planner"
        />
        <div className="mt-3.5">
          <HomePlan spaces={spaces} tasks={planToday} pro={pro} />
        </div>
      </section>

      <section className="mt-6.5">
        <SectionHeader icon={<Icon name="document" size={22} />} title="Recent documents" />
        <div className="mt-3.5">
          {recentDocuments.length === 0 ? (
            <EmptyState
              icon={<Icon name="document" size={24} />}
              title="No documents yet"
              description="Upload your files to a Space to learn them, ask them, or make something from them."
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {recentDocuments.map((d) => (
                <DocumentCard
                  key={d.id}
                  href={`/spaces/${d.space.id}`}
                  title={d.title}
                  fileType={d.fileType}
                  status={d.status}
                  statusLabel={statusLabel[d.status]}
                  primaryMeta={d.pageCount ? `${d.pageCount} pages` : "Processing…"}
                  secondaryMeta={relative.format(d.daysAgo, "day")}
                  spaceName={d.space.name}
                  spaceColor={uiColor(d.space.color)}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
