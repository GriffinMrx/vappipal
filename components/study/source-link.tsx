import Link from "next/link";
import { viewerHref } from "@/lib/documents/viewer";
import { cn } from "@/lib/cn";
import type { FileType } from "@/lib/generated/prisma/enums";
import { FileText } from "lucide-react";

/** "Page 4 · Cell biology.pdf" → opens the user's own file at that page (AGENTS.md §7). */
export function SourceLink({
  spaceId,
  source,
  className,
}: {
  spaceId: string;
  source: { documentId: string; title: string; fileType: FileType; page: number };
  className?: string;
}) {
  const unit = source.fileType === "PPTX" ? "Slide" : source.fileType === "IMAGE" ? "Photo" : "Page";
  // Opens Vappi's viewer at that page / slide.
  return (
    <Link
      href={viewerHref(spaceId, source.documentId, source.fileType === "IMAGE" ? null : source.page)}
      className={cn(
        "inline-flex min-h-11 max-w-full items-center gap-1.5 text-xs font-semibold text-fg-muted underline-offset-2 hover:text-fg hover:underline lg:min-h-0",
        className,
      )}
    >
      <FileText aria-hidden className="size-3.5 shrink-0" />
      <span className="min-w-0 wrap-anywhere">
        {unit === "Photo" ? "Photo" : `${unit} ${source.page}`} · {source.title}
      </span>
    </Link>
  );
}
