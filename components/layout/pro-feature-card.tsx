import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

/** A Pro-only feature on the free plan: say what it is and offer the upgrade (AGENTS.md §11). */
export function ProFeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <Card className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-bold text-fg">{title}</p>
        <p className="text-xs text-fg-muted">{description}</p>
      </div>
      <Link href="/billing" className={buttonClasses({ variant: "accent", size: "md", className: "shrink-0" })}>
        Upgrade
      </Link>
    </Card>
  );
}
