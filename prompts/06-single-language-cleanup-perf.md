# 06 — One UI language, cleanup, instant navigation

## Goal
Follow the updated AGENTS.md:
- **No translation or multi-language support.** One UI language; students use their browser's translation.
- Users are worldwide.

Remove everything related to languages, delete files that aren't part of the app, and make navigation **instant** (fix the Next.js "Instant · uncached data during navigation" insight). Also cut weight (fonts, deps).

## Docs read
- `AGENTS.md` (updated): §1 (any student, anywhere), §7 ("Do not build translation or multi-language support…"), §8 (User: email, name, plan, created time + time zone; **no language**), §10 and §12 (time zones everywhere, never server time).
- `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md`: client navigations only re-render **below the shared layout**, so a `<Suspense>` in the `(app)` layout can't cover navigations between `/home`, `/subjects`, and so on. Each page needs its own boundary for uncached reads. Static parts should render outside Suspense so the shell is instant.
- `authentication-with-cache-components.md`: session reads go inside Suspense, as close to the dynamic UI as possible.

## Code inspected
- i18n: `lib/i18n/{index,en,fr,ar}.ts` and their uses in the `(app)` layout, home, coming-next, subject page, subjects provider/views/dialog, and `lib/subjects/actions.ts`; `dir`/`lang` wrapper; the IBM Plex Sans Arabic font in `app/layout.tsx`.
- Schema: `Language` enum, `User.language`, `Document.language`; `timeZone` default `Africa/Casablanca`.
- Unused: `public/{file,globe,next,vercel,window}.svg` (create-next-app leftovers), default `README.md`, `components/ui/{avatar,divider,search-input,select}.tsx` (only used by the showcase, and search isn't in the MVP), the dev showcase `app/design-system/*` (with the RTL toggle and Arabic samples), the dev proof route `app/api/health/db` (its job is done; health is now covered by real pages).
- `@neon/config` is used only by `neon.ts` (the CLI), so it moves to devDependencies.

## Decisions
1. **UI language = English** (worldwide audience). All strings are plain English in the components. Delete `lib/i18n/`. Keep `dir="auto"` on user-written text (subject names, document titles), so notes in any script still display correctly. That's not translation.
2. **Fonts**: remove IBM Plex Sans Arabic. Keep Plus Jakarta Sans only (latin + latin-ext).
3. **Schema** (migration `drop_language`, dev branch): drop `User.language`, `Document.language`, and the `Language` enum. Change the `User.timeZone` default from `Africa/Casablanca` to `"UTC"`.
4. **Time zone** (needed now that users are worldwide): a tiny client `TimeZoneSync` in the app shell reads the browser's `Intl…timeZone`. If it differs from the stored value, it calls the server action `syncTimeZone` (validated IANA name, scoped to the user, then a refresh). No UI. A manual setting can come with Settings later.
5. **Instant navigation**:
   - The `(app)` layout's **static** parts (logo, nav links, menu labels) render outside Suspense, so they're in the static shell.
   - Only the user-dependent parts suspend, each with its own small fallback: the subject list + switcher, the Upgrade card, and the top-bar user button.
   - Each page gets its own `loading.tsx` (home, subjects, subjects/[subjectId], planner, billing, settings). That's a boundary **below** the shared layout, so client navigations show the page skeleton instantly while data streams.
   - Subjects state for optimistic UI: the layout creates **one** request-scoped promise (`listSubjects` inside a Suspense child) and passes it into a client `SubjectsProvider`. Consumers unwrap it with `use()` inside their own Suspense boundaries, following the pattern in the Next.js auth + cache components guide, so nothing above the page blocks.
6. **Lighter queries**: `getCurrentDbUser` selects only the needed columns. Home's counts run in parallel (already). No `SELECT *` on documents.
7. **Delete**: the showcase (`app/design-system/`), `app/api/health/db/`, `public/*.svg`, `README.md` (replaced by a short project README: what Vappi is, scripts, env setup, Neon dev-branch rule), and the unused UI components listed above. **Keep** the components that upcoming MVP features use (tabs → subject page, progress → uploads, badge/card/dialog/etc.).
8. Remove the "Design system" link from the landing page. `/` stays the public landing.

## Files
- **Edit**: `prisma/schema.prisma` (+ migration), `app/layout.tsx`, `app/page.tsx`, `app/(app)/layout.tsx`, `app/(app)/home/page.tsx`, `app/(app)/subjects/[subjectId]/page.tsx`, `components/layout/coming-next.tsx`, `components/subjects/*`, `lib/subjects/{actions,queries}.ts`, `lib/auth/current-user.ts`, `package.json`, `README.md`
- **Add**: `app/(app)/*/loading.tsx`, `components/layout/time-zone-sync.tsx`, `lib/user/actions.ts`
- **Delete**: `lib/i18n/`, `app/design-system/`, `app/api/health/`, `public/*.svg`, `components/ui/{avatar,divider,search-input,select}.tsx`

## Security
`syncTimeZone` validates the time zone with `Intl.DateTimeFormat` (it throws on unknown names), caps the length, and updates only the caller's row. No other change to auth or scoping.

## Acceptance criteria
- No language selector, dictionaries, `dir="rtl"`, or Arabic font remain. The UI is English everywhere.
- The Next.js dev "Instant" insight no longer appears when navigating between app pages (Home ↔ Subjects ↔ Planner…) or into the app from `/`.
- Optimistic create still works (success + offline rollback), and the sidebar list updates at once.
- The time zone auto-updates from the browser (verified by setting a different zone in the test browser).
- `prisma migrate status` is clean on dev. tsc, lint, and build pass. The build output lists only real routes.

## Checks
`prisma migrate dev`, tsc, lint, build, then browser runs on the running dev server: navigations with the Next.js insights/console checked for "instant" errors, optimistic create success + offline, time-zone sync, 375px.

## Manual test
1. Restart `npm run dev`, sign in. Home is in English.
2. Click Home → Subjects → Planner → Home: each page shows its skeleton instantly, with no orange "Insight" badge.
3. Create a subject: it shows instantly. Go offline and try again: it rolls back with an error and your text is kept.
4. Change your computer's time zone and reload: the greeting and date follow it.
