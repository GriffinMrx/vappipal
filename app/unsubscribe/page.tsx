import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { unsubscribeByToken } from "@/lib/reminders/unsubscribe";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Unsubscribe · Vappi", robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Public page from the email's Unsubscribe link. Opening it changes nothing
 * (mail scanners open links); the button POSTs. Bad tokens get the same page.
 */
export default function UnsubscribePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <Card className="flex w-full max-w-md flex-col gap-4 p-6">
        <p className="text-xl font-extrabold tracking-tight text-fg">Vappi</p>
        <Suspense fallback={<div className="h-28" aria-hidden />}>
          <UnsubscribeContent searchParams={searchParams} />
        </Suspense>
      </Card>
    </main>
  );
}

async function UnsubscribeContent({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const done = sp.done === "1";

  async function confirm(formData: FormData) {
    "use server";
    await unsubscribeByToken(formData.get("token"));
    redirect("/unsubscribe?done=1");
  }

  return done ? (
          <>
            <h1 className="text-lg font-bold text-fg">Daily reminders are off</h1>
            <p className="text-sm text-fg-muted">You won&apos;t get the daily email any more. You can turn it back on in Settings.</p>
            <Link href="/settings" className="min-h-11 self-start pt-2 text-sm font-semibold text-fg-body underline-offset-2 hover:underline">
              Open Settings
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold text-fg">Turn off daily reminders?</h1>
            <p className="text-sm text-fg-muted">You&apos;ll stop getting the morning email with today&apos;s flashcards and plan.</p>
            <form action={confirm}>
              <input type="hidden" name="token" value={token} />
              <Button type="submit" variant="primary" size="lg" className="w-full">
                Turn off reminders
              </Button>
            </form>
          </>
        );
}
