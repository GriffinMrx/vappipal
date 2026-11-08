import { cn } from "@/lib/cn";
import { iconData, type IconName } from "./generated";

export type { IconName };

/** Duotone icon from assets/icons. Colour follows `currentColor`. */
export function Icon({
  name,
  size = 20,
  className,
  label,
}: {
  name: IconName;
  size?: number;
  className?: string;
  /** Accessible label. Omit for decorative icons. */
  label?: string;
}) {
  const { viewBox, body } = iconData[name];
  return (
    <svg
      viewBox={viewBox}
      width={size}
      height={size}
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable="false"
    >
      {body}
    </svg>
  );
}
