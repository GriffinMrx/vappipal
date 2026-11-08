import type { ReactNode } from "react";

/** "PERSONAL" eyebrow + big page title, with optional actions on the end side. */
export function PageHeader({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pt-8 sm:pt-[2.125rem]">
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow && (
          <p className="text-eyebrow font-semibold tracking-wide text-fg-subtle uppercase">{eyebrow}</p>
        )}
        <h1 dir="auto" className="text-[1.75rem] leading-tight font-bold wrap-anywhere text-fg sm:text-page-title">
          {title}
        </h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
