"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { mockManage } from "@/lib/billing/actions";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons/icon";
import { CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Usage = { label: string; used: number; limit: number | null };

/** "Your plan" card: status line, free-plan usage, and Manage billing (mock for now). */
export function CurrentPlan({
  title,
  detail,
  warning,
  pro,
  usage,
  manage,
  mockAllowed,
}: {
  title: string;
  detail: string;
  warning?: string;
  pro: boolean;
  usage: Usage[];
  /** What Manage billing can do for this plan. */
  manage: { cancel: boolean; resume: boolean; endNow: boolean };
  mockAllowed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const canManage = mockAllowed && (manage.cancel || manage.resume || manage.endNow);

  return (
    <Card className="flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden
            className={cn(
              "inline-flex size-10 shrink-0 items-center justify-center rounded-full",
              pro ? "bg-linear-to-b from-accent-top to-accent-bottom text-accent-fg" : "bg-surface-active text-fg-muted",
            )}
          >
            <Icon name="crown" size={20} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">Your plan</p>
            <p className="text-lg font-bold text-fg wrap-anywhere">{title}</p>
            <p className="text-sm text-fg-muted">{detail}</p>
          </div>
        </div>
        {canManage && (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Manage billing
          </Button>
        )}
      </div>

      {warning && (
        <p role="status" className="flex items-start gap-2 rounded-control bg-warning/10 px-3 py-2.5 text-sm text-warning">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {warning}
        </p>
      )}

      {!pro && usage.length > 0 && (
        <div className="grid grid-cols-1 gap-4 border-t border-border pt-5 sm:grid-cols-3">
          {usage.map((u) => (
            <div key={u.label} className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-2 text-xs">
                <span className="text-fg-muted">{u.label}</span>
                <span className={cn("tabular-nums", u.limit !== null && u.used >= u.limit ? "text-warning" : "text-fg-subtle")}>
                  {u.used} / {u.limit ?? "∞"}
                </span>
              </div>
              <Progress value={u.limit ? (u.used / u.limit) * 100 : 0} label={`${u.label} used`} />
            </div>
          ))}
        </div>
      )}

      <ManageDialog open={open} onClose={() => setOpen(false)} manage={manage} />
    </Card>
  );
}

function ManageDialog({
  open,
  onClose,
  manage,
}: {
  open: boolean;
  onClose: () => void;
  manage: { cancel: boolean; resume: boolean; endNow: boolean };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(action: "cancel" | "resume" | "end_now", done: string) {
    setBusy(action);
    try {
      const res = await mockManage({ action });
      if (!res.ok) return toast({ tone: "error", title: "Not changed", description: res.error });
      toast({ tone: "success", title: done });
      onClose();
      router.refresh();
    } catch {
      toast({ tone: "error", title: "Not changed", description: "Check your connection and try again." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      title="Manage billing"
      description="Billing isn't connected yet, so these are test changes."
      closeLabel="Close"
    >
      <div className="flex flex-col gap-2">
        {manage.cancel && (
          <Button variant="secondary" className="w-full" loading={busy === "cancel"} disabled={!!busy} onClick={() => run("cancel", "Subscription cancelled. Pro stays until the end of the period.")}>
            Cancel subscription
          </Button>
        )}
        {manage.resume && (
          <Button variant="secondary" className="w-full" loading={busy === "resume"} disabled={!!busy} onClick={() => run("resume", "Subscription resumed")}>
            Resume subscription
          </Button>
        )}
        {manage.endNow && (
          <Button variant="danger" className="w-full" loading={busy === "end_now"} disabled={!!busy} onClick={() => run("end_now", "Plan ended. You're on Free.")}>
            End now (test)
          </Button>
        )}
      </div>
    </Dialog>
  );
}
