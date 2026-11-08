# 41 · AI daily limit: fail fast with a clear message

## Goal
When the AI provider says the daily quota is used up, stop retrying at once and tell the user plainly, instead of retrying for minutes and then showing "Something went wrong while reading this file."

## What I found
- A new upload of the Arabic PDF sat in Processing (EXTRACT RUNNING). OCR calls Gemini, and Gemini returns `429 … limit: 500 requests per day on Free Tier. Please retry in 8h2m36s`. I reproduced this outside the app.
- `mapError` in `lib/ai/gemini.ts` turns every 429 into `RetryAfterError`. Its regex can't read "8h2m36s", so it waits 30 s. `process-document` has `retries: 4`, so the file is stuck for minutes and then fails with `GENERIC_FAILURE`.
- Study steps (`runPart`) rethrow and retry the same way, then show "couldn't be created". Chat and Create show "The AI is busy right now. Try again in a moment.", which is wrong for an 8-hour limit.
- Every Gemini call (text, JSON, stream, embeddings, OCR) goes through `mapError`.

## Changes
1. `lib/ai/gemini.ts`: a 429 whose message says it is a daily quota (`per day` / `daily`, any case) throws `AiDailyLimitError`, a `NonRetriableError` named "AiDailyLimitError" with the message `AI_DAILY_LIMIT_MESSAGE` = "Vappi's AI has reached its daily limit. Try again later." Per-minute 429s and 503s keep the current retry behaviour.
2. `lib/jobs/process-document.ts` `onFailure`: the reason is the error's message when the name is `AiDailyLimitError` (as it already is for `UserFacingError`). The document shows Failed with that reason and the existing Retry button.
3. `lib/jobs/study-material.ts` `runPart`: an `AiDailyLimitError` marks just that step FAILED with the same message, with no retry.
4. `lib/chat/answer.ts` and the two Create routes: show that message instead of "busy" for this error. Errors are still logged by name only.

## Not changed
Per-minute rate limits, the retry counts, providers and models. No UI layout change: the existing Failed/Retry states show the text.

## Security
No file text, prompts or keys are logged (name or status only, as before).

## Checks
- `tsc`, `eslint`, `next build`.
- Node check: a fake 429 "per day" error → `AiDailyLimitError`; a 429 "per minute" error → `RetryAfterError` (unchanged).
- Live: with the quota still used up, the stuck Arabic upload (or a fresh one) turns Failed with the new message within seconds of the job running, not minutes.

## Manual test
1. While the quota is used up, upload a PDF that needs AI: it shows Failed with "Vappi's AI has reached its daily limit. Try again later." and a Retry button.
2. Ask a question in chat: the same message.
3. After the reset (or with a paid key), press Retry: the file becomes Ready.

## Outcome
- Verified: a "per day" 429 maps to AiDailyLimitError and a per-minute 429 still retries. Live, an English PDF uploaded during the exhausted quota became Ready in 49 s, with Summary, Flashcards and Quiz FAILED with the daily-limit message (no retry loop).
- Not verified live: an OCR upload during the limit (it should turn Failed with the message), and chat/Create showing the message.
