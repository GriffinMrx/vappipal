"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { sendTestReminder, setEmailReminders } from "@/lib/reminders/actions";
import { sendTestWelcome } from "@/lib/welcome/actions";
import { useOptimistic, useState, useTransition } from "react";

/** Daily reminder switch (optimistic) + the dev-only test send. */
export function ReminderSettings({
  on,
  hour,
  timeZone,
  canTest,
}: {
  on: boolean;
  hour: number;
  timeZone: string;
  canTest: boolean;
}) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [optimisticOn, setOptimisticOn] = useOptimistic(on);
  const [testing, setTesting] = useState(false);
  const [testingWelcome, setTestingWelcome] = useState(false);

  async function testWelcome() {
    setTestingWelcome(true);
    try {
      const res = await sendTestWelcome();
      if (res.ok)
        toast({
          tone: "success",
          title: res.mode === "resend" ? "Test welcome sent" : "Preview written",
          description: res.mode === "resend" ? "Check your inbox." : "No RESEND_API_KEY: see the .email-previews folder.",
        });
      else toast({ tone: "error", title: "No test email", description: res.error });
    } catch {
      toast({ tone: "error", title: "No test email", description: "Check your connection and try again." });
    } finally {
      setTestingWelcome(false);
    }
  }

  function toggle() {
    const next = !optimisticOn;
    startTransition(async () => {
      setOptimisticOn(next);
      try {
        const res = await setEmailReminders({ on: next });
        if (!res.ok) toast({ tone: "error", title: "Setting not saved", description: "Try again." });
      } catch {
        toast({ tone: "error", title: "Setting not saved", description: "Check your connection and try again." });
      }
    });
  }

  async function test() {
    setTesting(true);
    try {
      const res = await sendTestReminder();
      if (res.ok) {
        toast({
          tone: "success",
          title: res.mode === "resend" ? "Test reminder sent" : "Preview written",
          description: res.mode === "resend" ? "Check your inbox." : "No RESEND_API_KEY: see the .email-previews folder.",
        });
      } else toast({ tone: "error", title: "No test email", description: res.error });
    } catch {
      toast({ tone: "error", title: "No test email", description: "Check your connection and try again." });
    } finally {
      setTesting(false);
    }
  }

  const time = `${String(hour).padStart(2, "0")}:00`;

  return (
    <Card className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p id="reminders-label" className="text-sm font-bold text-fg">
            Daily reminder email
          </p>
          <p className="text-xs text-fg-muted wrap-anywhere">
            Around {time} your time ({timeZone}): the flashcards due today and your plan. Only on days with something to do.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={optimisticOn}
          aria-labelledby="reminders-label"
          onClick={toggle}
          className="inline-flex min-h-11 shrink-0 items-center"
        >
          <span
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-pill transition-colors",
              optimisticOn ? "bg-success" : "bg-surface-active",
            )}
          >
            <span
              className={cn(
                "absolute size-5 rounded-full bg-fg shadow transition-transform",
                optimisticOn ? "translate-x-5.5 rtl:-translate-x-5.5" : "translate-x-0.5 rtl:-translate-x-0.5",
              )}
            />
          </span>
        </button>
      </div>
      {canTest && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button variant="secondary" loading={testing} disabled={testing} onClick={test}>
            Send a test reminder now
          </Button>
          <Button variant="secondary" loading={testingWelcome} disabled={testingWelcome} onClick={testWelcome}>
            Send test welcome
          </Button>
          <span className="text-xs text-fg-subtle">Development only.</span>
        </div>
      )}
    </Card>
  );
}
