# 37 · Welcome email (email series 1 of 4)

The user asked for all the email features, then picked four new emails. They're built one per prompt, in order:

| Prompt | Email |
|---|---|
| 37 | **Welcome** (this one) |
| 38 | Your files are ready |
| 39 | Goal coming up |
| 40 | Plan ending soon |

## Goal
Send one welcome email when someone creates a Vappi account. It says what Vappi does and how to start, with a button that opens the app.

## What I inspected
- `app/api/webhooks/clerk/route.ts`: verified, deduped on `svix-id`, upserts the User on `user.created`.
- `lib/auth/current-user.ts`: also creates the User row on a first visit when the webhook is late. In local dev the webhook only arrives through a tunnel.
- `lib/email/send.ts`: Resend, idempotency keys, preview mode without a key. `lib/email/reminder-template.ts` and `lib/reminders/deliver.ts`.
- `lib/jobs/*` (Inngest client, events, `serve` list).

## Decisions
1. **Trigger.** Sending runs in an Inngest job, `email/welcome`, with retries, so sign-up never waits on email. The job is started:
   - by the Clerk webhook when `user.created` creates the row; **and**
   - by `getCurrentDbUser` when its first-visit path actually creates the row (`createMany` count = 1).

   Whichever happens first wins.
2. **Sent exactly once:**
   - New column `User.welcomeEmailAt DateTime?`, claimed atomically with `updateMany where welcomeEmailAt = null`.
   - The Inngest event id is `welcome-<userId>`.
   - The Resend idempotency key is `welcome/<userId>`.
   - Existing users (you included) are marked as already welcomed in the migration, so nobody gets a late welcome.
3. **Content** (English, plain and short):
   - "Hi {first name}, welcome to Vappi".
   - One line on what it is: your AI pal for your own files.
   - Three steps: **Create a Space**, **Upload your files** (PDF, PowerPoint, Word, photos of notes), then **Learn, Ask or Create**.
   - A button: **Create your first Space** → `/spaces?new=1`. If that route has no "new" handling, the button opens `/spaces`.
   - A text version as well.
   - No prices or limits; those live in the plan config.
4. **Shared layout.** New `lib/email/layout.ts` holds the common shell: wordmark, card, button, footer, escaping, and the same 560 px responsive table HTML. The reminder template moves onto it, with identical output; the next three emails reuse it.
5. **Footer:** "You're getting this because you created a Vappi account." No unsubscribe, since it's a one-time account email. A Settings link is included.
6. **Privacy:** logs never contain the address or name.
7. **Dev testing:** Settings' development-only test section gets **Send test welcome**. It sends now, marked "[Test]", and doesn't count.

## Files
- New:
  - `lib/email/layout.ts`
  - `lib/email/welcome-template.ts`
  - `lib/welcome/deliver.ts`
  - Inngest function `sendWelcome` in `lib/jobs/welcome.ts`
  - a migration
- Changed:
  - the Clerk webhook
  - `lib/auth/current-user.ts`
  - `lib/jobs/client.ts`
  - `app/api/inngest/route.ts`
  - `lib/email/reminder-template.ts` (moved onto the layout)
  - Settings: dev test button

## Acceptance
1. A brand-new user (a Clerk test user created through the backend API, then signed in) gets exactly one welcome email, even when both the webhook path and the first-visit path run. Checked with the column, the Resend id, and the Inngest run.
2. The test button delivers a "[Test] Welcome to Vappi" email to your inbox through Resend.
3. Existing users are not emailed.
4. The reminder email still renders the same, compared before and after.
5. Email HTML checked at 320 px and 600 px wide.
6. tsc, lint, build; migration applied on the dev branch only; the test user deleted.

## Implementation notes
- **Shared modules:**
  - `firstName` moved to `lib/user/name.ts` and `appUrl` to `lib/app-url.ts`. Both are plain modules, so email code doesn't pull in Clerk or React. The old exports re-export them.
  - The reminder email moved onto `lib/email/layout.ts`. Its output is identical apart from `'` → `&#39;` in "here's", which displays the same.
- **Tested with a real new account:**
  - A Clerk test user at `delivered+…@resend.dev` (Resend's test inbox; works without a domain), with two first visits at once.
  - One `email/welcome` event; its Inngest run completed and claimed `welcomeEmailAt`.
  - Replaying the webhook's send (same event id): Inngest recorded the event but started no run.
  - Two more direct sends: both "already-sent".
  - Existing users were marked by the migration (0 left unmarked).
  - The test user was deleted from Clerk and the database.
- **Settings → Send test welcome** sent "[Test] Welcome to Vappi" through Resend to your account email.
- **Email HTML:** no sideways scroll at 320 or 600 px.
