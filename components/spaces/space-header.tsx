"use client";

import { PageHeader } from "@/components/layout/page-header";
import { ActionMenu } from "@/components/ui/action-menu";
import { buttonClasses } from "@/components/ui/button";
import type { SpaceColor } from "@/lib/generated/prisma/enums";
import { formatDay } from "@/lib/spaces/format";
import { goalName } from "@/lib/spaces/goal";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useSpacesContext, useSpaceView } from "./spaces-provider";

/** Space page title + ⋯ (Edit / Delete). Shows optimistic edits at once. */
export function SpaceHeader({
  space,
  documentCount,
  actions,
}: {
  space: { id: string; name: string; goalDate: string | null; goalLabel: string | null; color: SpaceColor };
  documentCount: number;
  actions?: ReactNode;
}) {
  const { openEdit, askDelete } = useSpacesContext();
  const view = useSpaceView(space) ?? space;
  const count = documentCount === 1 ? "1 document" : `${documentCount} documents`;
  const goal = view.goalDate ? `${goalName(view.goalLabel)} ${formatDay(view.goalDate)}` : "No goal date";

  return (
    <PageHeader
      eyebrow={`Space · ${count} · ${goal}`}
      title={view.name}
      actions={
        <>
          {actions}
          <ActionMenu
            label={`More actions for ${view.name}`}
            trigger={<Ellipsis className="size-4" />}
            triggerClassName={buttonClasses({ variant: "subtle", size: "md", className: "w-11 px-0 lg:w-9" })}
            items={[
              { id: "edit", label: view.goalDate ? "Edit Space" : "Edit Space · add goal date", icon: <Pencil className="size-3.5" /> },
              { id: "delete", label: "Delete Space", icon: <Trash2 className="size-3.5" /> },
            ]}
            onSelect={(id) => (id === "edit" ? openEdit(view) : askDelete(view))}
          />
        </>
      }
    />
  );
}

/** "Add goal date" / "Edit Space" button for plan empty states. */
export function EditSpaceButton({
  space,
  label,
  variant = "secondary",
}: {
  space: { id: string; name: string; goalDate: string | null; goalLabel: string | null; color: SpaceColor };
  label: string;
  variant?: "secondary" | "accent" | "subtle";
}) {
  const { openEdit } = useSpacesContext();
  const view = useSpaceView(space) ?? space;
  return (
    <button type="button" onClick={() => openEdit(view)} className={buttonClasses({ variant, size: "md" })}>
      {label}
    </button>
  );
}
