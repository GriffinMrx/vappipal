# 42 · Uploads look stuck: hidden SDK retries on every failed AI call

## Goal
When an AI call fails (the daily limit, a rate limit, an overload), the job must learn about it at once, so files don't sit in "Starting…" or "Writing the summary…" for minutes.

## What I found
- Database: a new English upload sat in Processing for about 2 minutes. Its Summary, Flashcards and Quiz each took about 33 s to fail with the daily-limit message, one after another. There are no Arabic rows left (those were deleted in the app); the Arabic uploads hung in "Starting…" (OCR stage).
- Measured directly: one Gemini `interactions.create` call that gets a 429 takes **35.7 s** to throw, because the `@google/genai` SDK retries it twice with backoff before giving up. With the per-request option `maxRetries: 0` the same call throws in **0.8 s**.
- The client-level `httpOptions.retryOptions` (excluding 429) is **ignored** by `interactions.create` (measured: still 35.7 s). It applies to `models.*` calls such as `embedContent`.
- Inngest already retries failed steps (`RetryAfterError` waits the server's hint), and chat has its own retry loop, so the SDK retries only add hidden delay and use up extra quota.

## Changes (`lib/ai/gemini.ts` only)
1. Pass `maxRetries: 0` in the request options of the three `interactions.create` calls (JSON, text, stream).
2. Create the client with `httpOptions.retryOptions.attempts: 1` (no SDK retries for `embedContent` either). Inngest retries the embedding step.

## Effect
- Daily limit: OCR, summary, flashcards, quiz, chat and Create fail in about 1 s with "Vappi's AI has reached its daily limit. Try again later."
- Per-minute 429 or 503: still retried, by Inngest (jobs) after the server's hint, instead of silently inside one call.
- Chat: an overloaded model (503) now shows "busy" sooner instead of after a long silent wait; empty answers are still retried by chat's own loop.

## Checks
- `tsc`, `eslint`, `next build`.
- Live while the quota is still used up: an English PDF goes Processing → Ready with three daily-limit messages within about 10 s, and the Arabic PDF goes to Failed with the message within seconds.

## Manual test
1. Upload the Arabic PDF: within seconds it shows Failed with the daily-limit message and Retry.
2. Upload an English PDF: it becomes Ready within seconds; Summary shows the message with Try again.
3. After the quota resets: press Retry / Try again, and everything is generated.

## Outcome
- Live (quota still used up): "Write summary" on the English upload went RUNNING → FAILED with the daily-limit message in 1.2 s (before: about 33 s per part).
- Not verified live: an Arabic upload (no Arabic file left to reuse). The same call path was measured at 0.8 s.
