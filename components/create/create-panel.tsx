"use client";

import { AiIcon } from "@/components/ui/ai-icon";
import { ActionMenu } from "@/components/ui/action-menu";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { deleteCreation, duplicateCreation, renameCreation } from "@/lib/creations/actions";
import {
  CREATION_TYPES,
  INSTRUCTION_MAX,
  TITLE_MAX,
  TYPE_INFO,
  type CreationListItem,
  type CreationType,
} from "@/lib/creations/types";
import { Ellipsis, Files, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useOptimistic, useState } from "react";

type Patch = { id: string; title?: string; deleted?: boolean };

const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

/** Create tab: pick a type, add an instruction, and the Space's saved creations. */
export function CreatePanel({
  spaceId,
  items,
  allowance,
  hasFiles,
}: {
  spaceId: string;
  items: CreationListItem[];
  allowance: { used: number; limit: number | null; allowed: boolean };
  hasFiles: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [type, setType] = useState<CreationType>("NOTES");
  const [instruction, setInstruction] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CreationListItem | null>(null);
  const [list, patch] = useOptimistic(items, (state, p: Patch) =>
    p.deleted ? state.filter((c) => c.id !== p.id) : state.map((c) => (c.id === p.id ? { ...c, title: p.title ?? c.title } : c)),
  );

  const create = () => {
    const q = new URLSearchParams({ type });
    if (instruction.trim()) q.set("instruction", instruction.trim());
    q.set("n", Date.now().toString(36)); // one-time: a refresh mid-writing reopens this one instead of a second
    router.push(`/spaces/${spaceId}/create/new?${q}`);
  };

  const rename = (c: CreationListItem, title: string) => {
    setRenaming(null);
    const next = title.trim();
    if (!next || next === c.title) return;
    startTransition(async () => {
      patch({ id: c.id, title: next });
      const res = await renameCreation({ id: c.id, title: next }).catch(() => ({ ok: false as const, error: "Check your connection and try again." }));
      if (!res.ok) toast({ tone: "error", title: "Not renamed", description: res.error });
      else router.refresh();
    });
  };

  const remove = (c: CreationListItem) => {
    setDeleting(null);
    startTransition(async () => {
      patch({ id: c.id, deleted: true });
      const res = await deleteCreation({ id: c.id }).catch(() => ({ ok: false as const, error: "" }));
      if (!res.ok) toast({ tone: "error", title: "Not deleted", description: "Check your connection and try again." });
      else {
        toast({ tone: "success", title: "Deleted", description: c.title });
        router.refresh();
      }
    });
  };

  const duplicate = async (c: CreationListItem) => {
    const res = await duplicateCreation({ id: c.id }).catch(() => null);
    if (res?.ok) {
      toast({ tone: "success", title: "Duplicated", description: c.title });
      router.refresh();
    } else toast({ tone: "error", title: "Not duplicated", description: "Check your connection and try again." });
  };

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="create-title" className="rounded-card border border-border bg-surface/40 p-4 sm:p-5">
        <h2 id="create-title" className="text-base font-bold text-fg">
          Make something from your files
        </h2>
        <p className="mt-1 text-sm text-fg-muted">Vappi writes it live from your files, with the pages it used.</p>

        <div role="radiogroup" aria-label="What to make" className="mt-4 grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:grid-cols-5">
          {CREATION_TYPES.map((t) => {
            const info = TYPE_INFO[t];
            const on = t === type;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setType(t)}
                className={cn(
                  "flex min-h-11 items-start gap-3 rounded-card border p-3 text-start transition-colors lg:flex-col lg:gap-2",
                  on ? "border-accent-rim bg-accent-bottom/20 text-fg" : "border-border text-fg-body hover:bg-surface",
                )}
              >
                <span aria-hidden className="text-2xl leading-none">
                  {info.emoji}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-bold">{info.label}</span>
                  <span className="text-xs text-fg-muted">{info.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-fg-muted">Instruction (optional)</span>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            maxLength={INSTRUCTION_MAX}
            rows={2}
            placeholder="For my manager · keep it short · for kids…"
            className="w-full resize-y rounded-control border border-border bg-bg px-3 py-2.5 text-base text-fg placeholder:text-fg-subtle focus:border-border-strong focus:outline-none sm:text-sm"
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!hasFiles ? (
            <p className="text-sm text-fg-muted">Upload a file to this Space first; Vappi only uses your own files.</p>
          ) : allowance.allowed ? (
            <button type="button" onClick={create} className={buttonClasses({ variant: "accent", size: "lg" })}>
              <AiIcon />
              Create {TYPE_INFO[type].label.toLowerCase()}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface px-4 py-3">
              <p className="text-sm text-fg-body">
                You&apos;ve used your {allowance.limit} free creations this week. Pro makes unlimited.
              </p>
              <Link href="/billing" className={buttonClasses({ variant: "accent", size: "md" })}>
                Upgrade
              </Link>
            </div>
          )}
          {allowance.limit !== null && allowance.allowed && hasFiles && (
            <span className="text-xs text-fg-subtle">
              {allowance.used} of {allowance.limit} free this week
            </span>
          )}
        </div>
      </section>

      <section aria-labelledby="creations-title">
        <h2 id="creations-title" className="text-base font-bold text-fg">
          Your creations
        </h2>
        {list.length === 0 ? (
          <p className="mt-3 rounded-card border border-dashed border-border px-4 py-8 text-center text-sm text-fg-muted">
            Nothing yet. What you make here is saved in this Space.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {list.map((c) => (
              <li key={c.id} className="relative flex items-center gap-3 rounded-card border border-border bg-surface/40 p-3 hover:bg-surface">
                <span aria-hidden className="inline-flex size-11 shrink-0 items-center justify-center rounded-card bg-surface text-2xl">
                  {c.icon ?? TYPE_INFO[c.type].emoji}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  {renaming === c.id ? (
                    <input
                      autoFocus
                      aria-label="Title"
                      defaultValue={c.title}
                      maxLength={TITLE_MAX}
                      onFocus={(e) => e.currentTarget.select()}
                      onBlur={(e) => rename(c, e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") rename(c, e.currentTarget.value);
                        else if (e.key === "Escape") setRenaming(null);
                      }}
                      className="relative z-10 w-full rounded-control bg-bg px-2 py-1 text-sm font-bold text-fg outline-none ring-1 ring-border-strong"
                    />
                  ) : (
                    <Link
                      href={`/spaces/${spaceId}/create/${c.id}`}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        setRenaming(c.id);
                      }}
                      className="truncate text-sm font-bold text-fg after:absolute after:inset-0 after:rounded-card"
                    >
                      {c.title}
                    </Link>
                  )}
                  <span className="text-xs text-fg-subtle">
                    {TYPE_INFO[c.type].label} · {when.format(new Date(c.updatedAt))}
                    {c.pages ? ` · ${c.pages} page${c.pages === 1 ? "" : "s"}` : ""}
                    {c.status === "FAILED" ? " · didn't finish" : c.status === "WRITING" ? " · unfinished" : ""}
                  </span>
                </div>
                <div className="relative z-10">
                  <ActionMenu
                    label={`More actions for ${c.title}`}
                    trigger={<Ellipsis className="size-4" />}
                    triggerClassName={buttonClasses({ variant: "subtle", size: "md", className: "w-11 px-0 lg:w-9" })}
                    items={[
                      { id: "rename", label: "Rename", icon: <Pencil className="size-3.5" /> },
                      { id: "duplicate", label: "Duplicate", icon: <Files className="size-3.5" /> },
                      { id: "delete", label: "Delete", icon: <Trash2 className="size-3.5" /> },
                    ]}
                    onSelect={(a) => (a === "rename" ? setRenaming(c.id) : a === "duplicate" ? void duplicate(c) : setDeleting(c))}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this creation?"
        description={deleting ? `“${deleting.title}” will be deleted. This can't be undone.` : undefined}
        closeLabel="Cancel"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => deleting && remove(deleting)}>
              Delete
            </Button>
          </>
        }
      >
        {null}
      </Dialog>
    </div>
  );
}
