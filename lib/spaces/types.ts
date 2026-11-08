import type { SpaceColor } from "@/lib/generated/prisma/enums";

/** Space as sent to the client (dates as "YYYY-MM-DD"). */
export type SpaceView = {
  id: string;
  name: string;
  color: SpaceColor;
  goalDate: string | null;
  /** "Exam", "Presentation"… null = just "Goal". */
  goalLabel: string | null;
  documentCount: number;
  /** True while an optimistic create is in flight. */
  pending?: boolean;
};

export const spaceColorValues = [
  "SLATE",
  "BLUE",
  "VIOLET",
  "PINK",
  "RED",
  "ORANGE",
  "GREEN",
  "TEAL",
] as const satisfies readonly SpaceColor[];

export type CreateSpaceResult =
  | { ok: true; space: SpaceView }
  | {
      ok: false;
      fieldErrors?: Partial<Record<"name" | "goalDate" | "goalLabel" | "color", string>>;
      formError?: string;
    };

export type UpdateSpaceResult =
  | { ok: true }
  | { ok: false; fieldErrors?: Partial<Record<"name" | "goalDate" | "goalLabel" | "color", string>>; formError?: string };

export type DeleteSpaceResult = { ok: true } | { ok: false; error: string };
