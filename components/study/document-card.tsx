import { Icon, type IconName } from "@/components/icons/icon";
import { StatusBadge, type DocumentStatus } from "@/components/ui/badge";
import { spaceDot, type SpaceColor } from "@/components/ui/letter-chip";
import { cn } from "@/lib/cn";
import { FileText } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export type DocumentFileType = "PDF" | "PPTX" | "DOCX" | "IMAGE";

// TODO: switch PPTX to "file-powerpoint" once that icon is exported.
const fileTypeIcon: Record<DocumentFileType, IconName> = {
  PDF: "file-pdf",
  PPTX: "document",
  DOCX: "file-word",
  IMAGE: "file-image",
};

type DocumentCardProps = {
  href: string;
  title: string;
  fileType: DocumentFileType;
  status: DocumentStatus;
  statusLabel: string;
  /** e.g. "24 pages" */
  primaryMeta: string;
  /** e.g. "4d ago" */
  secondaryMeta: string;
  spaceName: string;
  spaceColor: SpaceColor;
  /** Overrides the default file-type icon. */
  fileIcon?: ReactNode;
  className?: string;
};

/** Video-style card from the reference, adapted to an uploaded document. */
export function DocumentCard({
  href,
  title,
  fileType,
  status,
  statusLabel,
  primaryMeta,
  secondaryMeta,
  spaceName,
  spaceColor,
  fileIcon,
  className,
}: DocumentCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col overflow-hidden rounded-card border border-border/60 bg-surface/40 transition-colors hover:border-border hover:bg-surface",
        className,
      )}
    >
      {/* Thumbnail placeholder — holds the file-type icon instead of an image. */}
      <div className="relative flex aspect-video items-center justify-center bg-bg-sidebar">
        <span className="text-fg-subtle transition-colors group-hover:text-fg-muted">
          {fileIcon ?? <Icon name={fileTypeIcon[fileType]} size={44} />}
        </span>
        <StatusBadge status={status} label={statusLabel} className="absolute start-3 top-3" />
        <span className="absolute end-3 top-3 rounded-md bg-surface-active px-1.5 py-0.5 text-[0.625rem] font-bold text-fg-muted">
          {fileType}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 pt-4 pb-4">
        <p
          dir="auto"
          className="min-h-[2.5rem] text-sm leading-5 font-bold wrap-anywhere text-fg-body group-hover:text-fg"
        >
          {title}
        </p>

        <div className="flex items-center gap-3">
          <FileText aria-hidden strokeWidth={2} className="size-6 shrink-0 text-fg" />
          <div className="flex min-w-0 flex-col">
            <span className="text-xs font-medium wrap-anywhere text-fg-muted">{primaryMeta}</span>
            <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
              <span aria-hidden className="size-1 rounded-full bg-fg-subtle" />
              {secondaryMeta}
            </span>
          </div>
        </div>

        <span className="mt-auto flex items-center gap-1.5 text-[0.6875rem] font-semibold text-fg-muted">
          <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", spaceDot[spaceColor])} />
          <span dir="auto" className="wrap-anywhere">
            {spaceName}
          </span>
        </span>
      </div>
    </Link>
  );
}
