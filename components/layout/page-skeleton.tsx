import { Skeleton } from "@/components/ui/skeleton";

/** Page-level loading state (rendered inside the static app shell). */
export function PageSkeleton({ tiles = false }: { tiles?: boolean }) {
  return (
    <div className="flex flex-col gap-6 pt-8 sm:pt-[2.125rem]" aria-busy aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-64 max-w-full" />
      </div>
      {tiles && (
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[4.75rem] rounded-card" />
          ))}
        </div>
      )}
      <Skeleton className="h-40 w-full rounded-card" />
    </div>
  );
}
