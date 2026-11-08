import { cn } from "@/lib/cn";

export const spaceColors = [
  "slate",
  "blue",
  "violet",
  "pink",
  "red",
  "orange",
  "green",
  "teal",
] as const;
export type SpaceColor = (typeof spaceColors)[number];

const chipBg: Record<SpaceColor, string> = {
  slate: "bg-space-slate/25 text-fg-body",
  blue: "bg-space-blue/25 text-space-blue",
  violet: "bg-space-violet/25 text-space-violet",
  pink: "bg-space-pink/25 text-space-pink",
  red: "bg-space-red/25 text-space-red",
  orange: "bg-space-orange/25 text-space-orange",
  green: "bg-space-green/25 text-space-green",
  teal: "bg-space-teal/25 text-space-teal",
};

export const spaceDot: Record<SpaceColor, string> = {
  slate: "bg-space-slate",
  blue: "bg-space-blue",
  violet: "bg-space-violet",
  pink: "bg-space-pink",
  red: "bg-space-red",
  orange: "bg-space-orange",
  green: "bg-space-green",
  teal: "bg-space-teal",
};

/** Rounded square with the first letter ("P", "S", "F" in the reference sidebar). */
export function LetterChip({
  name,
  color = "slate",
  className,
}: {
  name: string;
  color?: SpaceColor;
  className?: string;
}) {
  const letter = Array.from(name.trim())[0]?.toUpperCase() ?? "?";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold",
        chipBg[color],
        className,
      )}
    >
      {letter}
    </span>
  );
}
