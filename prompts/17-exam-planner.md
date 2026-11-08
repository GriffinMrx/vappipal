# 17 — Feature 6: Exam planner (+ edit / delete subject)

The student sets an exam date, and the server builds a **daily plan** from today to the exam with **plain code, no AI**:
- read a document's summary,
- review the flashcards due that day,
- take a quiz.

The last days are kept for review. Tasks can be ticked off, optimistically. The plan rebuilds when the exam date changes or documents are added or removed, and it keeps ticked tasks.

Exam dates must be editable for this, and AGENTS.md §7 lists **renaming and deleting a subject** as optimistic actions that don't exist yet, so this feature adds **Edit subject** (name, exam date, colour) and **Delete subject** too. Billing stays mocked; the planner is Pro (`npm run dev:pro`).

## Docs and code read
- AGENTS.md:
  - §1/§7: the planner is Pro. Optimistic UI for "marking a plan task as done" and "creating, renaming, or deleting a subject" (roll back + toast on failure, never lose typed text). One server Pro helper.
  - §10: build with plain code. Spread documents over the days, put flashcard reviews on the days they're due, and keep the last days for review and quizzes. Rebuild on exam-date change and on documents added or removed, keeping done tasks. Every quiz answer is an Attempt; every grade updates the next review.
  - §11: the subject page shows the plan.
  - §12: "today" is in the student's time zone, never server time (DST-safe).
- Code:
  - Schema `StudyPlanDay(subjectId, userId, date @db.Date, tasks Json, done)`, unique `(subjectId, date)`: **no migration needed**.
  - `Subject.examDate @db.Date`, `Flashcard.nextReviewAt`/`repetitions`/`documentId`, `Document.status`.
  - `lib/dates.ts` (`dayInZone`, `nextDay`, `daysBetween`, `dayToDateColumn`, `dateColumnToDay`).
  - `lib/subjects/actions.ts` (`createSubject` only), `components/subjects/subjects-provider.tsx` (optimistic create, `useMergedSubjects`), `create-subject-dialog.tsx`, `subject-views.tsx` (`HomePlan` empty state).
  - `app/(app)/planner/page.tsx` (a "Coming next" placeholder), `app/(app)/home/page.tsx`.
  - `components/ui/action-menu.tsx`, `dialog.tsx`, `date-picker.tsx`.
  - `lib/documents/actions.ts` (`deleteDocument`), `lib/jobs/process-document.ts` (finish step).
  - `lib/billing/access.ts`.

## Decisions

### Plan builder: `lib/planner/build.ts` (pure, unit-tested)
- **Input:**
  - today and the exam day (student's zone);
  - the subject's READY documents, in upload order;
  - each flashcard's due day (`nextReviewAt` → day in the zone; overdue → today), whether it's new (`repetitions = 0`), and its document;
  - whether the subject has quiz questions;
  - the existing done task ids.
- **Days:** from today up to the day **before** the exam. If the exam is today or tomorrow, today's plan is "review all due cards + quiz".
- **Review days:** the last `R = N ≥ 7 ? 3 : N ≥ 4 ? 2 : N ≥ 2 ? 1 : 0` days. The remaining `S` days are study days.
- **Reading:** document `i` of `D` goes on study day `floor(i · S / D)`, so several per day when `D > S`. Task: "Read the summary · {title}". A document whose read task is already done is not scheduled again.
- **Flashcards:**
  - A card already reviewed goes on its due day.
  - A **new** card goes on the day its document is read (or today if that document was read already), so day 1 isn't 200 cards.
  - Cards due after the exam aren't planned.
  - Review days also pull in every card not yet planned.
  - The task is "Review {n} flashcards", omitted when n = 0.
- **Quiz:** if the subject has questions, a "Take a quiz" goes every 3rd study day (day 3, 6, …) and on every review day.
- **Task ids are deterministic** so done state survives rebuilds: `read:{documentId}`, `cards:{day}`, `quiz:{day}`.
- **Output:** `[{ day, tasks: [{ id, kind: "read" | "cards" | "quiz", documentId?, title?, count?, done }] }]`.

### Storing and rebuilding: `lib/planner/service.ts`
- `rebuildPlan(userId, subjectId)`:
  - Loads the inputs and builds.
  - In one transaction, deletes the subject's days **from today on** and inserts the new ones. **Past days are never changed** (history).
  - Done ids are read from every day first, so ticked tasks stay ticked.
  - No exam date, or the exam has passed → future days deleted.
- **Triggers:**
  1. The exam date is set or changed (`updateSubject`).
  2. A document becomes Ready (the job's finish step).
  3. A document is deleted (`deleteDocument`).
  4. `ensurePlan` when a plan is viewed and there's no row for today yet, which refreshes the flashcard counts once a day. That's cheap plain code with no AI.
- `day.done` = all of that day's tasks done.

### Ticking a task: `lib/planner/actions.ts`
- `setTaskDone({ subjectId, day, taskId, done })`.
- It re-checks the user, Pro, ownership and that the task exists. Zod validates it.
- It updates the JSON for that one row (the day row, scoped to `userId`).
- **Optimistic:** the tick shows at once, and on failure it rolls back with an error toast.

### Edit / delete subject: `lib/subjects/actions.ts`
- `updateSubject({ id, name, examDate, color })`:
  - Same Zod rules as create. The exam date can't be in the past, but **an existing past date may be cleared**.
  - Rebuilds the plan if the date changed.
- `deleteSubject({ id })`:
  - Cascades in the DB (documents, chunks, cards, questions, chat, plan).
  - Also deletes the subject's stored files from the bucket, best effort, after the DB delete.
- **UI:**
  - A ⋯ `ActionMenu` in the subject page header: "Edit subject" (reuses the create dialog with the title "Edit subject" and the values filled in) and "Delete subject" (a confirm dialog naming the subject and what's lost).
  - **Optimistic:** the provider gains an optimistic `patches` map, so the sidebar, cards, home and the page title update at once. Delete hides it everywhere and goes to `/subjects`.
  - On failure: roll back, show a toast, and re-open the dialog with what was typed.

### Where the plan shows (Pro; free users see the existing upgrade-card pattern)
- **`/planner`** (replaces the placeholder):
  - **"Today"**: all subjects' tasks for today, grouped by subject, each a 44px checkbox row with a link (read → `?tab=summary&doc=…`, cards → `?tab=flashcards`, quiz → `?tab=quiz`).
  - Then **one card per subject with an exam**: "Biology · Exam in 12 days · Mon 24 Nov", a progress bar (tasks done / total), and the next 14 days as rows (date, task summary, done state). "Show all N days" expands the rest.
  - Subjects without a date are listed under "No exam date" with an **Add exam date** button (opens Edit).
- **Subject page:** a new **Plan** tab (after Chat) with that subject's card, or "Add an exam date".
- **Home "Today's plan":** replaces the empty state with today's tasks (same rows, max 6, "Open planner" link). The empty states stay for no exam / nothing today.
- Dates are formatted in the student's zone (`formatDay`). There's no calendar grid: the rows stack on mobile, with no sideways scroll.

## Files
- **New:**
  - `lib/planner/build.ts`, `lib/planner/service.ts`, `lib/planner/actions.ts`, `lib/planner/queries.ts`, `lib/planner/types.ts`
  - `components/planner/plan-task-list.tsx`, `components/planner/subject-plan-card.tsx`
  - `components/subjects/subject-menu.tsx`, `components/subjects/subject-title.tsx`
- **Edit:**
  - `lib/subjects/actions.ts`, `lib/subjects/types.ts`
  - `components/subjects/subjects-provider.tsx`, `create-subject-dialog.tsx` (title/submit label props), `subject-views.tsx` (`HomePlan`), `subject-tabs.tsx`
  - `app/(app)/planner/page.tsx`, `app/(app)/home/page.tsx`, `app/(app)/subjects/[subjectId]/page.tsx`
  - `lib/documents/actions.ts`, `lib/jobs/process-document.ts`

## Security
- Every action re-checks the user and ownership (`where: { id, userId }`) and validates with Zod. The planner actions also check Pro on the server.
- Plan rows are always read and written with `userId`.
- Delete subject removes only that user's files (keys from their own documents).
- No AI is involved, and no course text leaves the server.

## Acceptance criteria
- **Plans build correctly:**
  - Set an exam 10 days out on a subject with 3 Ready documents. The plan shows 10 days; reading is spread over the first 7, with flashcard counts and quizzes, and the last 3 days are review.
  - Exam tomorrow → today has cards + quiz.
- **Ticking survives:** tick a task → it's instant and still ticked after a refresh. Change the exam date → the plan rebuilds and the ticked task is still ticked. Upload or delete a document → the plan updates.
- **Failure rolls back:** with the network offline, ticking, editing or deleting rolls back with a toast. The edit dialog re-opens with the typed values.
- **Edit and delete subject** work and update the sidebar, home and title at once. Delete removes the subject's files too.
- **Access is enforced:** a free user sees the upgrade card in Planner and the Plan tab, and the action refuses. Signed out / another user is refused.
- **Time zones:** "today" follows the student's time zone, and a DST change doesn't shift days (unit test).
- **Layout:** 320–1920 with no horizontal scroll, 44px rows.

## Checks
- `tsc`, lint, build.
- Unit tests for `build.ts` (spread, review days, new cards, done kept, exam today/tomorrow, DST zone).
- A dev-branch script: rebuild on a real subject, toggle, change the date, delete a document, then confirm done is kept.
- Signed-in server action calls via a Clerk session token where possible.

## Manual test
1. `npm run dev:pro`, `npm run dev`, `npm run inngest`.
2. Subject → ⋯ → **Edit subject** → set an exam date 10 days out → Save. The title and sidebar update at once.
3. The **Plan** tab shows the days. Tick "Read the summary" → it's ticked at once; refresh → still ticked.
4. **Planner** in the sidebar shows Today plus the subject card. **Home** shows Today's plan.
5. Change the exam date → the plan changes, and ticked tasks stay ticked.
6. Go offline → tick a task → it rolls back with an error toast.
7. ⋯ → **Delete subject** (a test subject) → it disappears everywhere.

## Implementation notes (after building)
- **Stored shape:** `StudyPlanDay.tasks` is `{ review, tasks[] }`. The schema comment changed, but there's no migration, since it's JSON.
- **A done task stays where it was ticked.** A ticked "Read the summary" stays on **today** after a rebuild, even though done reads aren't rescheduled. The first version dropped it from today; it was caught in testing and fixed.
- **DST test correction:** Morocco is UTC+0 during Ramadan 2026 (around 18 Feb – 19 Mar), so 23:30 UTC on 1 March is still 1 March there. `dayInZone` was right; the test's expectation was wrong.
- **`SubjectsProvider` can't use `usePathname()`.** It wraps the static layout, which broke the PPR prerender, so it reads `window.location.pathname` at click time instead.
- **`/subjects` was a "Coming next" placeholder,** and Delete redirects there. It now shows the existing subject grid.
- **The plan also rebuilds** after a flashcards or quiz regeneration (`regenerate.ts`), plus the triggers in the prompt.
- **Tested:**
  - 7/7 builder unit tests.
  - Dev-branch service tests: 10 days with 3 review days, a tick kept through a date change, the rebuild on first view of a day, and clearing the date clears future days.
  - Signed-in renders (Clerk session tokens) of `/home`, `/planner`, `/subjects` and the Plan/Chat tabs, as a Pro user and as a free user.
  - The user's book subject got a temporary exam date for one test and was restored.
- **Not tested here:** the server actions over HTTP (tick, edit, delete). They need the browser, so they're listed for manual testing.
