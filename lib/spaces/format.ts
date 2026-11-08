import type { SpaceColor as UiSpaceColor } from "@/components/ui/letter-chip";
import type { SpaceColor } from "@/lib/generated/prisma/enums";

// Plain helpers (no "use client") so both server and client components can call them.

/** DB space colour → UI token name. */
export const uiColor = (c: SpaceColor) => c.toLowerCase() as UiSpaceColor;

const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** "YYYY-MM-DD" → "12 Dec". */
export const formatDay = (day: string) => dayFormat.format(new Date(`${day}T00:00:00Z`));
