import { cn } from "@/lib/cn";
import Link from "next/link";

/**
 * A Space has its Files plus three modes: Learn (Summary · Flashcards · Quiz ·
 * Plan), Ask (the chat) and Create. The URL keeps one `tab` value, so older
 * links (?tab=summary, ?tab=chat…) keep working.
 */
export const SPACE_TABS = ["documents", "summary", "flashcards", "quiz", "plan", "ask", "create"] as const;
export type SpaceTab = (typeof SPACE_TABS)[number];

export type SpaceMode = "files" | "learn" | "ask" | "create";
export const LEARN_TABS = ["summary", "flashcards", "quiz", "plan"] as const satisfies readonly SpaceTab[];

export function parseTab(value: string | string[] | undefined): SpaceTab {
  const v = Array.isArray(value) ? value[0] : value;
  if (v === "learn") return "summary";
  if (v === "chat") return "ask";
  return (SPACE_TABS as readonly string[]).includes(v ?? "") ? (v as SpaceTab) : "documents";
}

export function modeOf(tab: SpaceTab): SpaceMode {
  if (tab === "documents") return "files";
  if (tab === "ask" || tab === "create") return tab;
  return "learn";
}

export const spaceTabHref = (spaceId: string, tab: SpaceTab) =>
  tab === "documents" ? `/spaces/${spaceId}` : `/spaces/${spaceId}?tab=${tab}`;

type Item = { key: string; label: string; href: string; badge?: string };

/**
 * Pill tabs as links (state lives in the URL, so refresh/back keep it). On
 * small screens the row scrolls inside itself, never the page. `size="sm"`
 * is the Learn sub-row.
 */
export function SpaceTabs({
  label,
  active,
  items,
  size = "md",
}: {
  label: string;
  active: string;
  items: Item[];
  size?: "md" | "sm";
}) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none]">
      <ul className="flex w-max gap-2 md:w-auto md:flex-wrap">
        {items.map(({ key, label: text, href, badge }) => {
          const selected = key === active;
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={selected ? "page" : undefined}
                scroll={false}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-pill font-semibold whitespace-nowrap transition-colors",
                  size === "md" ? "px-5 text-sm" : "px-4 text-[0.8125rem] lg:h-9",
                  selected
                    ? size === "md"
                      ? "bg-surface-active text-fg"
                      : "bg-surface text-fg shadow-[inset_0_0_0_1px_var(--color-border-strong)]"
                    : "text-fg-muted hover:bg-surface hover:text-fg",
                )}
              >
                {text}
                {badge && (
                  <span
                    className={cn(
                      "rounded-pill px-2 py-0.5 text-[0.6875rem] font-bold",
                      selected ? "bg-fg/10 text-fg" : "bg-surface-active text-fg-muted",
                    )}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
