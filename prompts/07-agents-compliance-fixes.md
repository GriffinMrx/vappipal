# 07 — AGENTS.md compliance fixes (from the full test pass)

## Goal
Fix every ❌ found by the full AGENTS.md §3/§13 test pass on the current app (landing, sign-in/up, app shell, Home, Subjects, subject page, Planner/Billing/Settings, create-subject dialog, mobile menu), then re-run the same pass. The desktop look must not change.

## What the test found
1. **New student crash**: the first page load after sign-up shows "This page couldn't load". Several request islands call `getCurrentDbUser` in parallel. Each sees no row and runs `upsert`, and the losers fail with `Unique constraint failed on User_pkey`. That blocked the different-user tests.
2. **Tap targets under 44px on touch widths (< 1024px)**:
   - **Top bar**: menu 40px, New subject 32/36px, user button 28px.
   - **Home**: "See all" 20px.
   - **Mobile menu**: links 40px, logo link 32px, subject switcher 40px, close 40px.
   - **Create dialog**: inputs 40px, close 40px, color swatches 32px.
   - **Clerk sign-in/up**: inputs, buttons, and Google button 32px, show-password 26px, footer links 18px.
3. **Long text cut off**: a subject name with a long word is cut with "…" in cards, the sidebar, the tile label, and the switcher. On the subject page the title overflows sideways at 1024px (+9px).

## Decisions
1. **User row creation, race-safe**: replace `upsert` with `createMany({ data: [...], skipDuplicates: true })` (an atomic `INSERT … ON CONFLICT DO NOTHING`), then read the row. Parallel first loads all succeed.
2. **Touch sizes only below `lg`** (phones and tablets, where the drawer replaces the sidebar), so the desktop matches the reference exactly. Use `max-lg:` utilities:
   - **Button**: `md` and `sm` sizes `max-lg:h-11`. The compact New subject becomes `max-lg:size-11`.
   - **IconButton**: `max-lg:size-11`.
   - **Inputs**: `max-lg:h-11`.
   - **Color swatches**: `max-lg:size-11`.
   - **Sidebar (drawer) links, switcher, and logo link**: `max-lg:min-h-11`.
   - **"See all"**: `min-h-11` hit area through padding, with no visual change.
   - **Clerk user button**: wrapped in a 44px hit area.
   - **Clerk forms**: through `appearance.elements` (`formFieldInput`, `formButtonPrimary`, `socialButtonsBlockButton`, `formFieldInputShowPasswordButton`, `footerActionLink`) with `max-lg:min-h-11` classes.
3. **Long text wraps instead of being cut** (§3 "long file names wrap"):
   - Subject names in cards, the sidebar list, and tile labels use `wrap-anywhere` (overflow-wrap: anywhere) instead of `truncate`.
   - Cards and tiles use `min-h` instead of a fixed `h`.
   - `PageHeader` titles and `DocumentCard` titles also get `wrap-anywhere`.
   - The native `<select>` switcher keeps its single line: options are system UI, and the closed control shows the start of the name. It stays a known limitation, listed in the report.
4. No other behaviour changes.

## Files
`lib/auth/current-user.ts`, `components/ui/{button,icon-button,input}.tsx`, `components/subjects/{subject-views,create-subject-dialog}.tsx`, `components/layout/{sidebar,nav-item,section-header,page-header,app-shell,mobile-nav}.tsx`, `components/study/{subject-card,document-card}.tsx`, `app/(app)/layout.tsx`, `lib/clerk-appearance.ts`

## Security
Unchanged. The user row is still created only for the authenticated Clerk id.

## Acceptance criteria
The full test pass (the same script) shows ✅ for:
- the signed-out redirects;
- every page at 320, 375, 414, 768, 1024, 1280, 1440, 1920 and landscape 667/844, with no sideways scroll and no cut-off text;
- tap targets ≥ 44px below 1024px;
- the dialog and the drawer;
- optimistic create (success with refresh, offline rollback);
- a signed-out server action;
- **a new second user** who loads Home without errors, sees none of user A's subjects, and gets a 404 on user A's subject URL.

The desktop (≥ 1024) visuals stay unchanged (compared by screenshot at 1440). tsc, lint, and build pass.

## Checks
tsc, lint, build, and the full browser test pass on the dev server (both test users).

## Manual test
1. Sign up a fresh account: Home loads on the first try.
2. On a phone (or DevTools 320/375): every button and link is easy to tap. Create a subject with a very long name: it wraps everywhere, with no sideways scroll.
3. Desktop 1440: looks the same as before.
