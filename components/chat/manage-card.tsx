"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { ChatMessageView } from "@/lib/chat/types";
import { applyManagePlan } from "@/lib/manage/actions";
import { Check, CircleAlert, ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

type Manage = NonNullable<ChatMessageView["manage"]>;

/**
 * Vappi's plan of changes to the Space. Nothing changes until "Do it"; then
 * each line shows ✅ / ❌ (not optimistic: real results from the server).
 */
export function ManageCard({ spaceId, manage, onChange }: { spaceId: string; manage: Manage; onChange: (m: Manage) => void }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const { reply, lines, ops, status, results } = manage;
  const anyDanger = lines.some((l) => l.danger);

  const apply = () => {
    onChange({ ...manage, status: "applying" });
    startTransition(async () => {
      try {
        const r = await applyManagePlan({ spaceId, ops });
        if (!r.ok) throw new Error(r.error);
        onChange({ ...manage, status: "applied", results: r.results });
        const failed = r.results.filter((x) => !x.ok).length;
        toast(
          failed
            ? { tone: "error", title: `${failed} change${failed === 1 ? "" : "s"} didn't work`, description: "The others were made." }
            : { tone: "success", title: "Done" },
        );
      } catch (err) {
        onChange({ ...manage, status: "ready" });
        toast({ tone: "error", title: "Nothing changed", description: err instanceof Error && err.message ? err.message : "Check your connection and try again." });
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[0.9375rem] leading-relaxed text-fg-body wrap-anywhere">{reply}</p>
      {lines.length > 0 && (
        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface/60 p-3 sm:p-4">
          <p className="text-xs font-semibold text-fg-muted">
            {status === "applied" ? "What I changed" : status === "cancelled" ? "Cancelled · nothing changed" : `Vappi will make ${lines.length} change${lines.length === 1 ? "" : "s"}`}
          </p>
          <ul className="flex flex-col gap-2">
            {lines.map((l, i) => {
              const r = results?.[i];
              return (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {r ? (
                    r.ok ? (
                      <Check aria-label="Done" className="mt-0.5 size-4 shrink-0 text-success" />
                    ) : (
                      <CircleAlert aria-label="Failed" className="mt-0.5 size-4 shrink-0 text-danger" />
                    )
                  ) : l.danger ? (
                    <Trash2 aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
                  ) : (
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-fg-muted" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={cn("wrap-anywhere", l.danger && !r ? "text-danger" : "text-fg-body", status === "cancelled" && "line-through opacity-60")}>
                      {l.label}
                    </span>
                    {r && !r.ok && r.error && <span className="block text-xs text-danger">{r.error}</span>}
                    {r?.ok && r.error && <span className="block text-xs text-fg-muted">{r.error}</span>}
                    {r?.link && (
                      <Link
                        href={r.link}
                        className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-accent-fg underline-offset-2 hover:underline lg:min-h-0"
                      >
                        <ExternalLink aria-hidden className="size-3.5" />
                        Open
                      </Link>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {(status === "ready" || status === "applying") && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button variant={anyDanger ? "danger" : "accent"} onClick={apply} disabled={pending || status === "applying"} className="min-h-11 px-4 lg:min-h-9">
                {status === "applying" ? "Working…" : "Do it"}
              </Button>
              <Button variant="ghost" onClick={() => onChange({ ...manage, status: "cancelled" })} disabled={pending || status === "applying"} className="min-h-11 px-4 lg:min-h-9">
                Cancel
              </Button>
              {anyDanger && <p className="text-xs text-fg-muted sm:ms-auto">Deleted things can&apos;t be brought back.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
