import { cn } from "@/lib/cn";

/** A grey page placeholder while a file loads. */
export function PageSkeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("aspect-[1/1.3] w-full animate-pulse rounded-md bg-surface", className)} />;
}
