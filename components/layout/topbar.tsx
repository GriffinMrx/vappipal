import type { ReactNode } from "react";

/** Top bar: [menu (mobile)] [search] ............ [actions] [avatar] */
export function Topbar({
  start,
  search,
  actions,
}: {
  start?: ReactNode;
  search?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-topbar items-center gap-3 bg-bg/95 px-4 backdrop-blur sm:px-6">
      {start}
      <div className="flex min-w-0 flex-1 items-center">{search}</div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">{actions}</div>
    </header>
  );
}
