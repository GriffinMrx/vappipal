# 43 · AI daily limit: say when it resets

## Goal
When Vappi's AI (Gemini) hits its daily limit, every AI feature should say so and tell the user when it resets, in their own time zone. For example: "Vappi's AI has reached its daily limit. It resets at 9:00 AM (in 3 h 20 min)." Today the message only says "Try again later."

## Docs read
- AGENTS.md §7 (no optimistic UI for AI), §12 (time zones: never use server time for "today"; no file text in logs).
- prompts/41-ai-daily-limit.md (how `AiDailyLimitError` was added).
- Gemini rate-limit docs: free-tier daily quotas (requests per day) reset at **midnight Pacific time**.

## Code inspected
- `lib/ai/messages.ts`: `AI_DAILY_LIMIT_MESSAGE` is a fixed string, which client code can import.
- `lib/ai/gemini.ts` `mapError`: a 429 that mentions "per day" or "daily" throws `AiDailyLimitError`.
- Where the message is shown:
  - Streams: `lib/chat/answer.ts` (Ask), `app/api/spaces/[spaceId]/creations/route.ts` (Create), `.../creations/[creationId]/edit/route.ts` (AI edit).
  - Stored in the database: `lib/jobs/process-document.ts` (`Document.failureReason`), `lib/jobs/study-material.ts` (`DocumentStep.error`), shown by `components/documents/document-list.tsx` and `components/study/summary-view.tsx` (which checks `=== AI_DAILY_LIMIT_MESSAGE`).
  - Not handled yet: short-answer grading (`lib/study/actions.ts`) rethrows the error and the user gets a generic crash. Pal side chat (`lib/manage/actions.ts`) shows "Something went wrong."
- `User.timeZone` exists (default "UTC"). `DocumentStep.updatedAt` and `Document.updatedAt` exist.

## Decisions and assumptions
- **The reset time is computed, not hardcoded.** New env `AI_LIMIT_RESET_TZ=America/Los_Angeles` (the provider's reset time zone) and `AI_LIMIT_RESET_HOUR=0`. The helper finds the next reset moment using `Intl`, so it handles daylight saving time. If Vappi changes provider later, only the env changes.
- **The message is built on the server, in the user's time zone** (`User.timeZone`). The format is "It resets at 9:00 AM (in 3 h 20 min)." When the reset is on another calendar day for the user, the day is added ("tomorrow at 9:00 AM").
- **Stored failures stay as the fixed marker string** `AI_DAILY_LIMIT_MESSAGE`, so no schema change is needed. The full sentence is built when the page renders:
  - If the failure (its `updatedAt`) happened before the most recent reset, the limit has already reset. The text becomes "Vappi's AI limit has reset. Press Try again." The existing Retry button stays.
  - Otherwise it shows the reset time as above.
- **Streams** (Ask, Create, AI edit) send the full sentence in their existing `error` event.
- **Short-answer grading and Pal side chat** catch `AiDailyLimitError` and return the same sentence as their normal error, instead of crashing or saying "Something went wrong."
- **No live countdown.** The text is correct when shown, and it refreshes on the next render or poll. This keeps it simple.
- **No layout change.** The text appears where the current limit message appears.

## Files expected to touch
- `lib/ai/messages.ts`: keep the marker, add `AI_LIMIT_RESET_MESSAGE` ("…has reset. Press Try again.").
- New `lib/ai/limit-reset.ts` (server-only): `nextAiReset(now)`, `lastAiReset(now)`, `aiLimitMessage(userTimeZone, now, failedAt?)`.
- `lib/chat/answer.ts`, both Create routes, `lib/study/actions.ts`, `lib/manage/actions.ts`: use `aiLimitMessage`.
- `lib/documents/queries.ts`, `lib/study/queries.ts`: when the stored reason equals the marker, replace it with `aiLimitMessage(user tz, now, updatedAt)`.
- `components/study/summary-view.tsx`: show the message when it is a limit message (it currently compares against the exact marker).
- `.env.example`: the two new variables with comments.

## Requirements
- Every AI feature that can hit the limit shows the limit message with a reset time: upload processing, summary, flashcards, quiz, Ask, Create, AI edit, short-answer grading, and Pal side chat.
- The time is in the user's time zone, in 12-hour format with AM/PM, and correct across daylight saving changes.
- A stale stored failure (from before the reset) never shows a reset time in the past.
- Per-minute 429s keep "The AI is busy right now. Try again in a moment."

## Security
- Only the user's own time zone is read, from their own row.
- Logs keep the error name only, never prompts, file text or keys.
- Nothing new is sent to the browser except the message string.

## Acceptance criteria
- With the time zone set to Africa/Nairobi (UTC+3), a limit hit at 10:00 local shows "resets at 10:00 AM tomorrow (in 24 h)", or the right value for Pacific standard or daylight time on that date.
- A study step that failed yesterday before the reset shows "has reset. Press Try again."
- Responsive: the longer text wraps at 320px with no horizontal scroll, both in the summary card, the document row, the chat bubble and the Create error.

## Checks
- `tsc --noEmit`, `eslint`, `next build`.
- Node unit check of `nextAiReset`, `lastAiReset` and `aiLimitMessage`: normal day, the day DST starts and the day it ends in Los Angeles, a user tz ahead of UTC and one behind, and a failure before and after the last reset.

## Manual test steps
1. Force the limit: set `AI_FORCE_DAILY_LIMIT=1` in `.env.local` (dev only, ignored in production; added for this test) and restart `npm run dev`.
2. Ask a question in a Space: the error shows "…It resets at <time> (in <n> h <m> min)."
3. Try Create, AI edit, a short-answer quiz question, and Pal side chat: each shows the same sentence.
4. Upload a PDF (with `npm run inngest` running): it shows Failed with the same sentence and a Retry button. Open Learn: the summary card shows it too.
5. In Settings, change your time zone: the time in the message changes to match.
6. Remove `AI_FORCE_DAILY_LIMIT`, restart, press Retry: the file becomes Ready.
7. Check the messages at 320, 375, 768 and 1440 px widths.

## Outcome
- Built as above. Pal side chat errors come through the chat route (`app/api/spaces/[spaceId]/chat/route.ts`), not `lib/manage/actions.ts` (which never calls the AI), so the fix went there.
- One shared helper `aiErrorMessage(err, userId, fallback)` in `lib/ai/limit-message.ts` is used by Ask, side chat, Create, AI edit and short-answer grading.
- File list: a failed flashcards/quiz/summary step from the limit shows one extra line with the reset sentence under the failed parts.
- `AI_FORCE_DAILY_LIMIT=1` is checked in the Gemini `client()`, so every Gemini call (text, JSON, stream, embeddings, OCR) hits it.
- Verified: tsc, eslint, next build, and an 18-case Node check (winter/summer, both LA DST days, Nairobi, New York, bad tz, stale and fresh failures, env override).
- Not verified live in the browser (needs a signed-in session): manual steps 1–7 above.
