# 36 · Home: the stats row becomes 4 small area-chart cards

## Goal
The four Home tiles (Spaces · Cards due today · Documents · Next goal) become four small chart cards in the style of shadcn's area charts (https://ui.shadcn.com/charts/area): a headline number with a small gradient area chart under it. The user picked "4 small chart cards".

## What I inspected
- `components/spaces/space-views.tsx` (`HomeStats`, `StatTile`).
- `app/(app)/home/page.tsx`.
- `lib/spaces/queries.ts` (`getHomeData`).
- `lib/planner/*` (the plan days for the goal card).
- Prisma: `Flashcard.nextReviewAt`, `Attempt.createdAt / correct`, `Document.createdAt`, `PlanDay`.
- `lib/dates.ts`: every day is the user's day in their time zone.

## The four cards
Each card follows the same shape: label · headline · a one-line note · a ~64 px area chart · the time range.

| # | Card | Headline | Chart | Note |
|---|---|---|---|---|
| 1 | **Cards due** | due today (as now) | cards due on each of the next 14 days; today includes overdue cards | "next 14 days" |
| 2 | **Quiz answers** (replaces "Spaces"; the Spaces list is right below) | answers in the last 30 days · % correct | answers per day | "last 30 days" |
| 3 | **Documents** | total | documents you had on each of the last 30 days, so uploads show as steps up | "last 30 days" |
| 4 | **Next goal** | "Tomorrow" / "In 12 days" with "Exam · kids story", as now | plan tasks per day from today to the goal | "6 of 8 tasks done" |

- **Goal card when there's no chart:**
  - Free users (the planner is Pro): only the countdown, plus "Daily plan is a Pro feature".
  - No goal at all: "No goal date yet".
- **Empty data:** a flat line and a short note ("No quiz answers yet").

## Decisions
- **Charts:** shadcn's chart approach, meaning Recharts plus a small `components/ui/chart.tsx` adapted from shadcn: `ChartContainer` and a tooltip in our design tokens.
  - New dependency: `recharts`. The user asked for shadcn charts; no other UI library is added.
- **Data:** one server query each, all scoped to the user and bucketed by the user's day (`lib/home/activity.ts`). Nothing new is stored.
- **Look** (following the data-viz rules):
  - One series per card, so there's no legend: the card title names it.
  - The line is the accent violet, 2 px, with a vertical gradient fill fading to transparent.
  - No grid and no y-axis (sparkline-style cards). Values in text use text colors, not the series color.
  - Hover shows a crosshair and a tooltip with the day and its value (shadcn's tooltip, our tokens). Touch: tap shows the tooltip.
  - Each chart has an `aria-label` summary, and a visually hidden table of the values for screen readers.
- **Optimistic parts stay:** the goal headline still updates at once when a Space's goal changes.
- **Layout:** the grid is unchanged (1 column → 2 at 480 px → 4 at xl).
  - Cards grow a little taller (about 150 px).
  - No sideways scroll at 320–1920 px.

## Files
- New:
  - `components/ui/chart.tsx`
  - `components/home/stat-chart-card.tsx` (client)
  - `lib/home/activity.ts` (server queries)
- Changed:
  - `components/spaces/space-views.tsx` (`HomeStats`)
  - `app/(app)/home/page.tsx`
  - `package.json` (`recharts`)

## Acceptance
1. Home shows the 4 cards with real numbers:
   - Cards due today = the old number; the 14-day chart matches the database.
   - Quiz answers and % correct match the attempts.
   - Documents total = the old number.
   - The goal reads "Tomorrow" etc., with the plan tasks chart (Pro).
2. Hover or tap shows the day and value.
3. Free user: the goal card shows the countdown and the Pro note. Empty states read sensibly.
4. Checked at 320, 375, 414, 768, 1024, 1280, 1440 and 1920 px: no sideways scroll and no overlapping text.
5. tsc, lint, build.

## Implementation notes
- **Chart color:** the series color `--color-chart-1` (#8b5cf6) was checked with the data-viz validator against the card surface #1b1b1b in dark mode; all checks pass.
- **Screen-reader table:** a table ignores the 1 px `sr-only` box and caused sideways scroll, so the hidden table is wrapped in an `sr-only` div.
- **Single day:** a series with one point (a goal tomorrow) shows no chart, only the note.
- **Numbers checked against the database:**
  - 19 cards due today and 3 tomorrow.
  - 2 quiz answers in the last 30 days, 0 correct.
  - 1 document.
  - Goal tomorrow, 0 of 3 tasks done.
- **Free dev account:** "Daily plan is a Pro feature" and "No quiz answers yet".
- **Widths:** no sideways scroll at 320, 375, 414, 768, 1024, 1280, 1440 or 1920 px. The hover tooltip shows "Sun 8 Nov · Cards due 3".
