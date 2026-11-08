# 14 — Feature 4: Study screens (Summary · Flashcards · Quiz) + our own AI button

Fourth feature. Students can now *use* what feature 3 created. The subject page gets **tabs**: **Documents · Summary · Flashcards · Quiz**. Chat and Plan tabs come with their own features.

This step also adds our **own AI button** (original code, inspired by the public description of Wensity's paid "AI button", which we can't download). It's used for "Create study material" and every study-material Retry.

## Docs and code read
- AGENTS.md:
  - §3: no reference design, so build in the existing design system, responsive 320–1920, 44px targets, and flashcards and quizzes full width on mobile.
  - §7: grounded; always show the source page. SM-2 with `ease` + `nextReviewAt`, Again/Hard/Good/Easy, the server sets the next review. MC graded by code, short answer graded by AI against the stored answer. **Flashcard grading is optimistic** (`useOptimistic`, roll back + toast, server is the source of truth). Short-answer grading is **not** optimistic. Free plan: 2 quizzes per week, enforced on the server.
  - §10: every quiz answer is an Attempt, every grade updates the next review.
  - §11: summary short + long with key terms highlighted; review shows only due cards, one at a time, with an empty state; quiz shows the result after each answer with the correct answer, explanation and a source-page link; at a limit, show the limit + upgrade.
  - §12: "today" in the student's time zone.
- Memory: AI mocked behind real interfaces; billing mocked (`dev:pro`); helpers never exported from `"use client"` files; one feature per prompt.
- Code:
  - `app/(app)/subjects/[subjectId]/page.tsx` (one Documents section)
  - `components/ui/tabs.tsx` (pill tabs, client state)
  - `components/documents/*` (rows, Create/Retry buttons)
  - `lib/documents/actions.ts` (`regenerateStudyMaterial`)
  - `lib/limits.ts` (`checkLimit(user, "quiz")` over `UsageEvent` in the last 7 days)
  - `lib/dates.ts` (`endOfTodayInZone`)
  - `lib/subjects/queries.ts` (`getSubject`), `lib/subjects/format.ts`
  - The file route `/subjects/[s]/documents/[d]/file`
  - Schema: `Summary`, `Flashcard` (ease, intervalDays, repetitions, lapses, nextReviewAt, lastReviewedAt), `Question`, `Attempt` (answer, correct, feedback), `UsageEvent(QUIZ)`. No migration needed.
- Wensity "AI button" page (props and behaviour only, no code): states idle → loading → done/error, rotating loading labels with a shimmer, a spinning sparkle, a check that draws in on done, "Try again" on error, click again while loading to stop, a reduced-motion hold, screen-reader announcements.

## Decisions

### Tabs (URL-driven)
- `/subjects/[id]?tab=documents|summary|flashcards|quiz` (default `documents`). The tab bar is a row of **links** styled exactly like the existing pill `Tabs` (`role="tablist"`, the active link `aria-current="page"`). The server renders only the active tab's data. Back/forward and refresh keep the tab.
- Each tab label shows a small count: "Flashcards 12 due", "Quiz 30".
- On mobile the tab row scrolls horizontally *inside itself* (no page scroll) and every tab is 44px high.

### Summary tab
- **Document picker:** the existing `SelectMenu`, when the subject has more than one document with a summary. It defaults to the newest, and the selection is in the URL (`&doc=`).
- **Short / Long toggle:** small pill tabs. The default is Short.
- **Key terms highlighted:** every occurrence of each key term (whole word, case-insensitive) is wrapped in `<mark>`, styled with the `accent` tokens (`bg-accent-bottom/25 text-fg rounded px-0.5`). Matching is done on plain text, never by injecting HTML, so document text can't inject markup.
- The key terms are also listed as chips under the heading.
- An "Open document" link (file route) is shown.
- **Empty states:** "No summaries yet. Upload a file to this subject." / "This document's summary is being written…" / "The summary couldn't be created" + **AI button** Retry.

### Flashcards tab: review
- **Due cards only:** this subject, `nextReviewAt < end of the student's today` (time zone), oldest due first, at most 50 per session.
- **One card at a time, full width on mobile.** The card front is shown; **Show answer** (or Space/Enter) flips to the back.
- The back shows a **source link**, "Page 4 · Cell biology.pdf", which opens the file route at `#page=4` (PDF jumps to the page; PowerPoint/Word say "Slide 4" / "Page 4" and open the file).
- **Grades:** **Again · Hard · Good · Easy** buttons, with keys 1–4. Each shows its next interval ("<10 min", "1 d", "4 d", "9 d"), computed by the same SM-2 function the server uses.
- **SM-2** (`lib/study/sm2.ts`, a pure function used by the server and for the labels). q = Again 1, Hard 3, Good 4, Easy 5.
  - Ease: `ease' = max(1.3, ease + 0.1 − (5−q)(0.08 + (5−q)·0.02))`.
  - Again: repetitions 0, lapses+1, due in **10 minutes** (shown again in this session).
  - Otherwise: repetitions+1; interval 1 d, then 6 d, then `round(interval × ease')`. Hard uses `× 1.2` instead of the ease, and Easy adds `× 1.3`.
  - `nextReviewAt = now + interval`.
- **Optimistic:** grading moves to the next card at once (`useOptimistic` removes it from the queue, and Again re-queues it at the end). The server action `gradeFlashcard({ cardId, grade })` re-checks ownership, applies SM-2 from the **stored** values (never client values) and saves. On failure the card comes back to the front of the queue with an error toast.
- A progress line shows "7 of 20 · 13 left".
- **Empty state:** "Nothing due right now. Next card due tomorrow at 9:00" (time from the soonest `nextReviewAt`, in the student's time zone), or "No flashcards yet" with a link to Documents.
- **Done state:** "Session complete · 20 cards reviewed".

### Quiz tab
- **Start screen:** the number of questions available, plus "Start quiz (10 questions)". On Free it also shows "Free plan: 1 of 2 quizzes left this week".
- **Starting a quiz** (server action `startQuiz(subjectId)`):
  - re-checks the user and the subject
  - `checkLimit(user, "quiz")`; if it's reached, the limit card + Upgrade shows instead of starting
  - records `UsageEvent(QUIZ)`
  - picks up to 10 questions: unanswered first, then ones answered wrong, then the rest, shuffled
  - returns their ids; the order goes in the URL (`&q=` list), so a refresh continues the same quiz
- **One question at a time, full width on mobile:**
  - **Multiple choice:** 4 option buttons (44px+). Submitting goes to `answerQuestion` and **code** compares the answer to `answer`.
  - **Short answer:** a textarea, then submit. **AI grading (mock)** with the "smart" model slot (`AI_MODEL_SMART`): it compares the student's answer to the stored answer by meaningful-word overlap (≥ 50% of the answer's key words, or the key term present). It returns `{ correct, feedback }`, Zod-validated with the same retry-once rule.
  - Not optimistic: a loading state while grading, and the typed text stays.
- **After each answer:** correct/incorrect, the **correct answer**, the **explanation**, and the **source link** "Page 3 · file.pdf". Every answer is saved as an `Attempt` (`answer`, `correct`, `feedback`), owner-checked.
- **End:** score "7 / 10", a list of the questions missed (with source links), and "New quiz".
- Answering only works for questions of a quiz the server started for this user. Ids are re-checked for ownership on every answer.

### Our AI button (`components/ui/ai-button.tsx`, original code)
- Props: `onClick(e, { signal }) => Promise`, `children` ("Generate"), `loadingLabel` (string or string[], rotating every 1.6 s), `doneLabel`, `errorLabel` ("Try again"), `status` (optional external control), `size` sm/md/lg, `iconOnly`.
- **Look:** our **accent** purple button (same gradient, edges and glow as `variant="accent"`), with a lucide **Sparkles** icon. No duotone icons.
  - **Idle:** the sparkle tilts on hover.
  - **Loading:** the sparkle turns slowly and the label shimmers (a light band moving across the text using `background-clip:text`).
  - **Done:** a check draws in (SVG stroke animation), then it returns to idle after 1.8 s.
  - **Error:** the "Try again" label.
  - Clicking again while loading **stops** it (aborts the signal; the caller decides what stopping means; our callers just stop waiting).
- **Accessibility:** `aria-live="polite"` announces "Generating…", "Done", "Failed"; `aria-busy` while loading; 44px on touch; `prefers-reduced-motion` stops the spin, shimmer and draw.
- **Used for:** "Create study material", study-material **Retry** (on rows and in the Summary tab), and quiz short-answer **Check answer** is *not* an AI button (it's an ordinary submit). The loading labels are "Reading", "Writing" for creation and "Writing" for retry. The button stays loading until the server action has accepted **and** the part finished (it watches the polled status), then shows Done.

## Files
- New `components/ui/ai-button.tsx`; keyframes in `app/globals.css` (`ai-shimmer`, `ai-spin`, `ai-check`)
- New `components/subjects/subject-tabs.tsx` (link tab bar)
- New `lib/study/sm2.ts`, `lib/study/queries.ts` (summaries for a subject, due cards, quiz questions — all user-scoped), `lib/study/actions.ts` (`gradeFlashcard`, `startQuiz`, `answerQuestion`), `lib/ai/grading.ts` (short-answer grader, mock with provider switch + Zod)
- New `components/study/summary-view.tsx`, `flashcard-review.tsx`, `quiz-runner.tsx`, `source-link.tsx`, `highlight-terms.tsx`
- Edit `app/(app)/subjects/[subjectId]/page.tsx` (tabs, searchParams), `components/documents/document-list.tsx` (AI button for Create/Retry)

## Security
- Every query and action re-checks the Clerk user and ownership (card, question, subject). Another user's ids → "not found".
- SM-2 runs on the server from stored values. The client only sends `{ cardId, grade }` (Zod-checked enum).
- The quiz limit is enforced on the server in `startQuiz`. The UI only reflects it.
- Highlighting is plain-text splitting into React nodes (no `dangerouslySetInnerHTML`).
- Source links use the owner-checked file route (5-minute signed URL).
- Short-answer text goes only to the grader (mock now). It's never logged.

## Acceptance criteria
- The tabs switch by URL, survive a refresh, and show counts. Tab content renders only the student's own data.
- **Summary:** Short/Long toggle; key terms highlighted everywhere they appear; a picker for multiple documents; empty and failed states (failed → AI button Retry works).
- **Flashcards:** only due cards; flip; grades update `ease`, `intervalDays`, `repetitions`, `lapses`, `nextReviewAt` exactly per SM-2 (unit-tested); Again shows the card again this session; grading is instant, and when offline it rolls back with a toast; the empty state shows when the next card is due, in the student's time zone.
- **Quiz:**
  - MC graded by code, short answer by the mock grader.
  - Every answer creates an Attempt.
  - Each result shows the correct answer, the explanation and the source link.
  - The score screen works.
  - The Free 3rd quiz in 7 days shows the limit card (server-enforced); mock Pro is unlimited.
- **AI button:** idle/loading (rotating label, shimmer, spinning sparkle)/done (check)/error states; stop on second click; reduced motion respected.
- Responsive at every width; flashcards and quiz are full width on mobile; no horizontal page scroll.

## Checks
`npx tsc --noEmit`, `npm run lint`, `npm run build`.
- Unit tests: SM-2 table (each grade from new / learned cards; ease floor 1.3), the highlighter (case, whole words, overlapping terms), the short-answer grader + schema.
- Integration (temporary script, stubbed Clerk user, dev DB):
  - `gradeFlashcard` ownership + stored-value SM-2
  - `startQuiz` limit (Free 3rd blocked, Pro allowed) + question selection order
  - `answerQuestion` MC/short answer + Attempt rows + ownership
- The UI is checked in a browser if browser tools are available; otherwise you test it with the steps below.

## Manual test
1. `npm run dev` + `npm run inngest`. Open a subject with Ready documents.
2. **Summary tab:** switch Short/Long; key terms are highlighted; pick another document.
3. **Flashcards tab:** Show answer → the source link opens the right page → grade Good; the next card appears at once. Grade one **Again**: it comes back later in the session. Go offline and grade: the card returns with an error toast. Finish: "Session complete". Reload: those cards are no longer due.
4. **Quiz tab:** Start → answer an MC question right and one wrong → see the correct answer, explanation and source link. Answer a short question in your own words → see feedback. Finish → score.
5. As Free (`npm run dev:pro -- <id> off`), start 3 quizzes: the 3rd shows the limit card. Run `… on`: it starts.
6. On Documents, click **Create study material** / **Retry**: the AI button spins with "Reading… Writing…", then a check.
7. Check every tab at 320, 375, 768, 1024, 1440 and 1920 wide.

## Implementation notes (2026-11-07)
- The quiz "started by the server" check is an HMAC-signed token (user + question ids + time, 24 h), carried in the URL as `?tab=quiz&t=…`. No schema change.
  - The key is derived from `QUIZ_TOKEN_SECRET`, or from `CLERK_SECRET_KEY` with a purpose label.
  - Answers outside the token, another user's token, a tampered token and an expired token are all refused.
- Questions sent to the browser carry no answer or explanation. Those come back only from `answerQuestion`.
- Flashcard grading:
  - The optimistic queue uses `useOptimistic` over local state.
  - On server success, local state is updated in a new transition (updates after `await` aren't in the original one).
  - On failure the optimistic removal reverts and a toast shows.
- AI button: original code. The shimmer uses explicit accent colours, because `currentColor` is transparent with `bg-clip-text`. Create/Retry reject when the action doesn't start, so the button shows "Try again".
- Tests:
  - tsc, lint and build pass.
  - 40/40: SM-2 table, highlighter, grader, quiz token, plus integration for grade/start/answer, Free weekly limit, mock Pro, ownership.
  - Signed-out tab URLs render without server errors.
- Not tested in a browser (no browser tools in this session).
