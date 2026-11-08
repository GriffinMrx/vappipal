# 05 — Home (signed-in dashboard)

## Goal
Build the first real app page: **Home**, which a student lands on after signing in. Build it inside a real, protected app layout (sidebar + top bar from the design system). It shows only the student's real data: a time-aware greeting, today's summary, their subjects, and the next exam, plus the main action **Create a subject** (optimistic). It works in FR / EN / AR (RTL), on desktop and mobile.

## Design source
No reference image was provided for this page. AGENTS §3 says I don't design UI, so the page is **composed only from existing design-system parts** built from the Opal reference: `PageHeader` (eyebrow + title), `SectionHeader` (icon + title + "See all →"), `SubjectCard` row, the accent "Create a subject" button in the tabs row position, `Card` stat tiles in the folder-card style, and `EmptyState`. No new visual styles. **If you send a design image, it replaces this layout.**

## Docs read
- `AGENTS.md`: §3, §5, §7 (optimistic UI with `useOptimistic` + server actions, rollback + toast), §8 (Subject: name, exam date, color), §10 ("today" in the student's time zone), §11, §12 (Morocco DST, `dir="auto"` on user content)
- Next docs: `02-guides/internationalization.md`, `server-actions.md`, `authentication-with-cache-components.md` (session reads inside `<Suspense>`), `forms.md`
- Clerk skill `clerk-nextjs-patterns`: `auth.protect()` in each page and server action, no `createRouteMatcher`

## Code inspected
- `components/layout/*` (AppShell, Sidebar, NavItem, Topbar, PageHeader, SectionHeader, UpgradeCard), `components/study/subject-card.tsx`, `components/ui/*` (Dialog, Input, Button `accent`, EmptyState, Toast, Skeleton), `app/design-system/*` (current demo wiring), `lib/db.ts`, `prisma/schema.prisma` (only `User`), `app/page.tsx` (public landing with Clerk controls).

## Decisions
1. **Routes**
   - `app/(app)/layout.tsx` is the real shell for every signed-in page.
   - `app/(app)/home/page.tsx` is the dashboard.
   - The sidebar "Home" links to `/home`. Signed-in visitors on `/` get an "Open Vappi" link to `/home`, and Clerk's post-sign-in fallback is `/home` (`NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` / `…SIGN_UP…` in `.env.local` and `.env.example`).
2. **Protection**: the layout's data loader and every page and server action call `await auth.protect()`. A `loading.tsx` skeleton is added because session reads must sit inside Suspense.
3. **User row**: the Clerk webhook (the real creator) comes later. Until then, a server helper `getCurrentDbUser()` upserts the signed-in user from Clerk on first load (id, email, name). It's idempotent and keeps working after the webhook exists.
4. **Data model**: add **`Subject`** (§8): `id` (cuid), `userId` → User (cascade), `name`, `examDate` (date, nullable), `color` (enum of the 8 subject colors), `createdAt`/`updatedAt`, index on `userId`. Migration `add_subject` runs on the **dev** branch only. Documents, flashcards, and plan models are **not** added (their own prompts).
5. **i18n (minimal, no library)**:
   - `lib/i18n/` holds typed dictionaries `fr`, `en`, `ar` (FR is the default per §1) and `getDictionary(lang)`.
   - The language comes from `User.language` (AGENTS §7: from the user's setting).
   - The app layout wraps content in `<div lang dir>` (`rtl` for AR). The root `<html>` can't read the session without breaking the static shell under Cache Components.
   - Dates and greetings use `Intl` with the user's `timeZone`.
   - A language switcher comes with Settings.
6. **Dashboard content** (only real data):
   - **Header**: eyebrow = today's date in the user's time zone (for example "JEUDI 5 NOVEMBRE"). Title = time-of-day greeting with first name ("Bonsoir, Salma").
   - **Today row** (3 stat tiles): *Subjects* (count), *Next exam* ("Biologie · in 12 days" or "No exam date yet"), *Days until next exam*. Flashcards-due and quiz tiles are left out until those features exist, so no fake zeros.
   - **Subjects** section: a `SubjectCard` per subject (meta = "Exam 12 Jan" / "No exam date"), "See all" → `/subjects`, and the accent **Create a subject** button. Empty state: "Create your first subject" with the same CTA.
   - **Today's plan** section: an empty state that explains "Add an exam date to a subject to get your daily plan" (the planner prompt fills this later).
7. **Create a subject (optimistic, §7)**:
   - The dialog (name required ≤ 60 chars, optional exam date ≥ today in the user's time zone, color picker) calls the server action `createSubject` (Zod-validated, `auth.protect()`, scoped to the user).
   - `useOptimistic` adds the card at once with a pending style. On failure it rolls back, shows an error toast, and **keeps the typed values** in the dialog.
   - On success, `revalidatePath('/home')`.
8. **Sidebar**:
   - Real nav: Home `/home`, Subjects `/subjects`, Planner `/planner`, Billing `/billing`, Settings `/settings`, with duotone icons.
   - The "Subjects" list shows the user's real subjects (grey gradient chips, as in the reference).
   - The subject switcher selects a subject to open (navigates to `/subjects/[id]`, which is built later). It's hidden when the user has none.
   - Upgrade card shown for FREE users.
   - Routes not built yet (`/subjects`, `/planner`, `/billing`, `/settings`) get a minimal protected page: header + EmptyState "Coming next". **No fake content.**
9. **Top bar**: search field shown but disabled (search is a later feature)? → **Hidden** instead, to avoid a dead control. The Upload button is hidden until uploads exist. Kept: mobile menu, "New subject" (opens the same dialog), and the Clerk `UserButton`.
10. `/design-system` stays as the dev showcase and is unchanged.

## Files expected
- New: `app/(app)/layout.tsx`, `app/(app)/loading.tsx`, `app/(app)/home/page.tsx`, `app/(app)/home/create-subject.tsx` (client: dialog + optimistic list), `app/(app)/{subjects,planner,billing,settings}/page.tsx`, `lib/auth/current-user.ts`, `lib/subjects/actions.ts`, `lib/subjects/queries.ts`, `lib/i18n/{index,fr,en,ar}.ts`, `lib/dates.ts`, the Prisma migration `add_subject`
- Edited: `prisma/schema.prisma`, `app/page.tsx` (link to /home), `components/layout/sidebar.tsx` (switcher navigation, if needed), `.env.example`, `package.json` (`zod`)

## Security
- Every query is filtered by `userId` from `auth()`, never from client input. The server action re-checks auth and validates with Zod.
- Subject names render with `dir="auto"` as text (no HTML).
- No course data goes to analytics.

## Acceptance criteria
- Signed out, `/home` redirects to `/sign-in`. Signed in, after sign-in you land on `/home`.
- A new user sees the empty states and can create a subject. It appears instantly. After a refresh it's still there, in the sidebar list and the subjects row.
- Forced failure (offline): the card rolls back, an error toast shows, and the typed name is kept.
- Validation: an empty name or a past exam date shows field errors, server-side too.
- The greeting and date follow the user's time zone. FR is the default. AR renders RTL with Arabic text. EN works.
- Desktop matches the reference spacing. 375px: drawer nav, stacked tiles, full-width cards.
- tsc, lint, and build pass. `prisma migrate status` is clean on dev.

## Checks
`prisma migrate dev`, `tsc`, lint, build, then browser runs (test user) for the signed-out redirect, empty state, optimistic create (success + forced failure), refresh persistence, FR/EN/AR (switching the user's language in the DB for the test), and 375px.

## Manual test
1. Sign in: you land on `/home` with "Bonsoir/Bonjour, …" and today's date.
2. Click **Create a subject**, enter "Biologie", an exam date in 2 weeks, a color, and Create: the card shows instantly, and the Next exam tile reads "in 14 days".
3. Refresh: the subject is still there, and it shows in the sidebar.
4. DevTools → offline, create another subject: it disappears, an error toast shows, and the dialog keeps your text.
5. Resize to 375px: menu drawer, cards stack.

## Revision from your answer (2026-11-05): wire the whole data structure now, no features
Add **all** AGENTS §8 tables in one migration (`data_model`, dev branch only). No feature logic on them yet (no upload, AI, SRS scheduling, billing, or planner code):
- **User**: + relations, `emailReminders` (bool, default true).
- **Subject**: as above.
- **Document**: `subjectId`, `userId` (denormalized for scoping), `title` (original file name), `fileKey` (private storage key, never a public URL), `fileType` (PDF/PPTX/DOCX/IMAGE), `mimeType`, `sizeBytes`, `status` (PROCESSING/READY/FAILED, default PROCESSING), `failureReason?`, `pageCount?`, `language?`.
- **Chunk**: `documentId`, `userId`, `subjectId` (the vector search filters on user + subject, §12), `page`, `text`, `embedding Unsupported("vector(1536)")?`. Dimension 1536 is assumed for the embedding model; changing it later means a migration + re-embed. HNSW index deferred until there's real data (§12).
- **Summary**: one per document: `short`, `long`, `keyTerms String[]`.
- **Flashcard**: `subjectId`, `documentId`, `userId`, `front`, `back`, `sourcePage`, SM-2 fields `ease` (2.5), `intervalDays` (0), `repetitions` (0), `nextReviewAt` (now). Index `(userId, nextReviewAt)`.
- **Question**: `subjectId`, `documentId`, `userId`, `type` (MULTIPLE_CHOICE/SHORT_ANSWER), `question`, `options String[]`, `answer`, `explanation`, `sourcePage`. No Quiz grouping (no design needs it yet).
- **Attempt**: `userId`, `questionId`, `answer?`, `correct`, `createdAt`.
- **StudyPlanDay**: `subjectId`, `userId`, `date` (date), `tasks Json`, `done`. Unique `(subjectId, date)`.
- **Subscription**: `userId`, `lemonSqueezyId` (unique), `kind` (SUBSCRIPTION/EXAM_PASS), `variantId`, `status` (Lemon Squeezy statuses), `renewsAt?`, `endsAt?` (Exam Pass expiry), timestamps.
- **UsageEvent** (smallest free-plan usage tracking): `userId`, `kind` (QUIZ), `createdAt`. Weekly quizzes = count in the last 7 days. Documents and flashcards are counted from their own tables.
- All child rows cascade on delete, and all have a `userId` index.

The Home dashboard then reads **real** counts from these tables:
- **Stat tiles**: Subjects, Cards due today (`nextReviewAt` ≤ end of the student's day), Documents, Next exam.
- A **Recent documents** section (`DocumentCard`, empty state until uploads exist).

The post-sign-in redirect to `/home` is set through `ClerkProvider` `signInFallbackRedirectUrl` / `signUpFallbackRedirectUrl` props instead of editing `.env.local`.
