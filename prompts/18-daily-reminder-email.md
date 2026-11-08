# 18 — Feature 7: Daily reminder email (+ Settings)

One email a day, in the student's own morning, sent with **Resend**:
- "Today: 20 flashcards and 1 quiz",
- per subject, from the plan,
- with exam countdowns.

Students can turn it off in **Settings**, and every email has a one-click **unsubscribe** link. This is the last MVP feature before billing; billing stays mocked.

## Docs and code read
- AGENTS.md:
  - §10: a scheduled job sends one reminder a day with Resend in the student's time zone. Students can turn it off, and every email has an unsubscribe link.
  - §3: emails are responsive too.
  - §12:
    - "Today" depends on the zone, and DST changes during the year.
    - The Resend key is server-only.
    - No course text goes to analytics or logs.
  - §13: Inngest dev server for scheduled jobs.
- Resend docs (to fetch while building): the Node SDK `emails.send` (from/to/subject/html/text/headers), its idempotency key option, the rate limits, and the `onboarding@resend.dev` test sender, which only delivers to the account owner's email.
- Inngest docs: cron triggers (`{ cron: "TZ=UTC 0 * * * *" }`), fan-out with `step.sendEvent`, `throttle`, and idempotency.
- Code:
  - `User.emailReminders`, `lastReminderOn @db.Date`, `unsubscribeToken @unique` (all already in the schema, so **no migration**).
  - `lib/dates.ts` (`dayInZone`, `hourInZone`, `endOfTodayInZone`), `lib/planner/queries.ts` (`getPlans`, `todayTasks`), `lib/billing/access.ts`.
  - `lib/jobs/client.ts` (EVENTS), `app/api/inngest/route.ts`, `proxy.ts` (`clerkMiddleware()`, which leaves routes public unless a page protects itself).
  - `app/(app)/settings/page.tsx` (a "Coming next" placeholder).
  - `.env.example` (`APP_URL`). There's **no Resend key or package yet**.

## Decisions
- **Package:** add `resend` (the official SDK). No email template library: one hand-written, table-based HTML email plus a plain-text version.
- **Send modes** (`lib/email/send.ts`, server-only):
  - `RESEND_API_KEY` set → real send from `EMAIL_FROM` (env, e.g. `Vappi <reminders@your-domain>`).
  - With no key, in dev, it's **preview mode**: the email is written to `.email-previews/<day>-<user>.html` (gitignored) and nothing is sent.
  - In production with no key, it does nothing and logs "reminders disabled" once.
  - Until you verify a domain in Resend, `onboarding@resend.dev` only delivers to **your own Resend account email**.
- **When:** at `REMINDER_HOUR` local time (env, default 8).
  - An hourly Inngest cron (`reminders-scan`, `TZ=UTC 0 * * * *`) finds users with reminders on, whose local hour is between `REMINDER_HOUR` and 21, and who haven't been reminded today. Because it uses that range, a missed hour still sends later that morning.
  - It fans out one `reminders/send` event per user.
- **Per user** (`reminders-send`):
  - Event id `reminder-{userId}-{day}`, so Inngest drops duplicates. Throttled to 2 per second (Resend's default limit). Retries 3.
  - Builds the content:
    - flashcards due today (all plans);
    - for Pro, today's plan tasks per subject (read N summaries / N cards / quiz);
    - the next exams.
  - **Nothing to do → no email** (and no "you have 0 cards" spam).
  - Sends with the Resend idempotency key `reminder/{userId}/{day}`, then sets `lastReminderOn = today`, so a retry never sends twice.
- **Email content:**
  - Subject: "Today: 20 flashcards and 1 quiz".
  - Body:
    - a greeting with the first name;
    - one block per subject (name, tasks, "Exam in 12 days");
    - one **Start studying** button (→ `/planner` for Pro, `/home` for free);
    - the footer: "You get this because daily reminders are on. **Unsubscribe** · Manage in Settings".
  - Subject names and counts only: **no course text and no file names**. Light theme, max 560 px wide and fluid below that, a text wordmark (SVG logos don't render in many mail apps).
- **Unsubscribe:**
  - The link is `{APP_URL}/unsubscribe?token=…`, a public page outside the app group. It asks "Turn off daily reminders?" with a button; a POST turns them off, so mail scanners that open links can't unsubscribe anyone.
  - Plus the `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers pointing to `POST /api/unsubscribe?token=…` (one-click in Gmail and Apple Mail).
  - The token only turns reminders off, and a wrong token shows the same neutral page.
- **Settings page** (replaces the placeholder):
  - A "Daily reminder email" switch, optimistic (`useOptimistic`, with rollback and a toast).
  - Text showing the time ("around 8:00 in Africa/Casablanca").
  - In development only, a **Send a test reminder now** button, which uses the same builder and respects preview mode. It's not optimistic, because it shows real progress.
- **Env:** `RESEND_API_KEY`, `EMAIL_FROM`, `REMINDER_HOUR`, and `APP_URL` (already listed), all documented in `.env.example`.

## Files
- **New:**
  - `lib/email/send.ts`, `lib/email/reminder-template.ts`
  - `lib/reminders/content.ts` (builder), `lib/reminders/actions.ts` (toggle + test send)
  - `lib/jobs/reminders.ts` (scan + send)
  - `app/unsubscribe/page.tsx`, `app/api/unsubscribe/route.ts`
  - `components/settings/reminder-settings.tsx`
- **Edit:** `app/(app)/settings/page.tsx`, `lib/jobs/client.ts`, `app/api/inngest/route.ts`, `.env.example`, `.gitignore`, `package.json`.

## Security
- The Resend key is server-only.
- The unsubscribe token is random and unique per user. It can only turn reminders off, it's never logged, and lookups compare it exactly.
- The toggle action re-checks the user.
- The cron and send functions are Inngest-signed in production.
- Logs show counts and status only: never email addresses or subject names.

## Acceptance criteria
- At the student's local reminder hour, one email arrives (or a preview file appears) with the right counts. No second email the same day, even with retries or two cron runs.
- Users with nothing due get none, and users with reminders off get none.
- Time zones are respected: Casablanca at 08:00 local is sent, while a Tokyo user at 02:00 local isn't (unit test on the scan filter).
- The unsubscribe page turns reminders off with one click on the button. The one-click POST works, a bad token is harmless, and Settings shows the switch off.
- The Settings switch is optimistic and rolls back offline.
- The email renders at 320 px and on desktop (preview HTML checked at both widths).

## Checks
- `tsc`, lint, build.
- Unit tests for the scan filter (hours and zones, already-sent today) and the content builder (counts, nothing-to-do).
- On the dev branch through the Inngest dev server: trigger the scan, confirm one preview per eligible user, run it again and confirm no duplicates, and confirm `lastReminderOn` is set.
- If a Resend key is provided, send one real email to the account owner.
- Unsubscribe GET/POST with good and bad tokens.

## Manual test
1. (Optional) Create a Resend API key → `.env.local`: `RESEND_API_KEY=…`, `EMAIL_FROM="Vappi <onboarding@resend.dev>"`. Restart `npm run dev`.
2. Keep `npm run inngest` running.
3. Settings → **Send a test reminder now** → the email arrives in your inbox (or a file appears in `.email-previews/`).
4. Click **Unsubscribe** in the email → confirm → Settings shows reminders off.
5. Switch reminders on again in Settings. Offline → the switch flips back with an error toast.

## Implementation notes (after building)
- `resend@6.37.0`: `emails.send(payload, { idempotencyKey })` returns `{ data, error }`; a non-null error is thrown, so the Inngest step retries.
- **Time-zone test correction:** Node's time-zone data puts Africa/Casablanca at UTC+0 on 2026-11-07, not UTC+1 as I'd assumed. The code follows the time-zone data (correct), so the test now uses Europe/Paris. A DST case for New York (the 1 Nov switch) is included.
- **The `/unsubscribe` page reads `searchParams`,** so with Cache Components its content sits in a `<Suspense>` boundary; without it, the build fails at prerender.
- **Tested:**
  - 6/6 unit tests on the time rule and the template (escaping, unsubscribe link, text version).
  - Dev branch, through the Inngest dev server: `reminders/send` for all 3 users → 2 previews (the third had nothing due, so no email) and `lastReminderOn` set. Sending the same event twice and a second "scan" event the same day didn't resend.
  - Unsubscribe: GET changes nothing. A POST with a bad token is harmless and gives a neutral reply; a POST with a good token turns reminders off.
  - Settings renders signed in, with the switch and the test button.
  - Every user's reminder state was restored afterwards.
- **Not tested here:**
  - The hourly cron firing on its own; it runs at the top of each hour while `npm run inngest` is up.
  - A real Resend delivery (no key yet).
  - The Settings switch and test button clicks, and the unsubscribe page's form button (browser).
