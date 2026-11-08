import { PageHeader } from "@/components/layout/page-header";
import { ReminderSettings } from "@/components/settings/reminder-settings";
import { WritingSpeedSettings } from "@/components/settings/writing-speed-settings";
import { getCurrentDbUser } from "@/lib/auth/current-user";
import { hasProAccess } from "@/lib/billing/access";
import { db } from "@/lib/db";
import { reminderHour } from "@/lib/reminders/rules";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings · Vappi" };

export default async function SettingsPage() {
  const user = await getCurrentDbUser();
  const pro = await hasProAccess(user.id);
  const prefs = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { emailReminders: true, writingSpeed: true } });
  return (
    <>
      <PageHeader eyebrow="Account" title="Settings" />
      <section className="mt-8 flex max-w-2xl flex-col gap-3">
        <h2 className="text-lg font-medium text-fg-body">Email</h2>
        <ReminderSettings
          on={prefs.emailReminders}
          hour={reminderHour()}
          timeZone={user.timeZone}
          canTest={process.env.NODE_ENV !== "production"}
        />
      </section>
      {/* Vappi's AI writing in documents is Pro, so is its speed. */}
      {pro && (
        <section className="mt-8 flex max-w-2xl flex-col gap-3">
          <h2 className="text-lg font-medium text-fg-body">Vappi</h2>
          <WritingSpeedSettings speed={prefs.writingSpeed} />
        </section>
      )}
    </>
  );
}
