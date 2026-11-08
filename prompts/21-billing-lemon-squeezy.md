# 21 — Feature 8: Billing page with MOCK payments (Lemon Squeezy later)

The user's answer to the first draft was: "the implementation of Lemon Squeezy not now, mock the payment". So this step builds the **real Billing page and flows** (Free · Pro monthly/yearly · Exam Pass, current plan, cancel/resume) with a **mock checkout** instead of Lemon Squeezy.

The code is shaped so Lemon Squeezy plugs in later without touching the UI or access rules: the mock calls the same `applySubscription` / `applyOrder` functions the real webhook will call.

## Docs and code read
- AGENTS.md:
  - §7: plans, prices and limits come from env, not components.
  - §7: Pro = an active subscription or an unexpired Exam Pass, through **one** helper (`hasProAccess`).
  - §7: billing is **not** optimistic.
  - §5: the browser never writes plan state; only server code does.
  - §11: limits show the upgrade option.
  - Memory: "Lemon Squeezy is the final feature; plans stay mocked until then."
- Code:
  - `prisma/schema.prisma` `Subscription` (lemonSqueezyId unique, kind, variantId, status, testMode, renewsAt, endsAt): **no migration**.
  - `lib/billing/access.ts`, `lib/plans.ts` (`FREE_LIMITS`, `EXAM_PASS_DAYS`, `BILLING_TEST_MODE`).
  - `app/(app)/billing/page.tsx` (placeholder).
  - `app/(app)/layout.tsx` `UpgradeIsland`: it uses `user.plan`, so mocked Pro users still see "Upgrade to Pro".
  - `scripts/dev-pro.mjs`, `components/layout/pro-feature-card.tsx`, `components/ui/dialog.tsx`.

## Decisions
- **Prices:** display prices from env in `lib/plans.ts`: `PRICE_PRO_MONTHLY=7`, `PRICE_PRO_YEARLY=49`, `PRICE_EXAM_PASS=15`, `PRICE_CURRENCY=USD`. Components never hard-code them.
- **One place that changes billing state** (`lib/billing/apply.ts`, server-only):
  - `applySubscription({ userId, externalId, plan: "pro_monthly" | "pro_yearly", status, renewsAt, endsAt, testMode })` upserts the row.
  - `applyOrder({ userId, externalId, paidAt, testMode })` creates an Exam Pass. `endsAt` = the later of `paidAt` and any active pass's end, **+ 30 days**, so a second pass extends the first.
  - `refundOrder(externalId)`.
  - Each also syncs `User.plan`, as a display cache only.
  - The future Lemon Squeezy webhook will call exactly these.
- **Mock checkout** (`lib/billing/actions.ts`):
  - `mockCheckout({ plan })`: the server re-checks the user and Zod, and refuses a second active subscription.
  - It writes rows marked mock (`lemonSqueezyId: "mock-…"`, `testMode: true`, variant `mock-pro-monthly` and so on). Monthly renews in +1 month and yearly in +1 year.
  - **Allowed only while billing is mocked:** `BILLING_PROVIDER=mock` (the default until Lemon Squeezy exists). On a production deployment (`VERCEL_ENV=production`) the mock is refused unless `BILLING_MOCK_IN_PRODUCTION=true` is set on purpose, so real users can't give themselves Pro by accident.
- **Mock "Manage billing":**
  - `mockCancel()` sets status CANCELLED, active until the renewal date.
  - `mockResume()` sets it back to ACTIVE.
  - `mockEndNow()` makes the subscription or pass expire now, so the free state can be tested.
- **UI:**
  - Clicking a plan opens a **mock checkout dialog** with the plan, price, what's included, and a clear "Test payment, no money is charged" note. **Pay** shows a loading state, then the page refreshes into the new plan with a success toast. It's not optimistic.
  - "Manage billing" opens a dialog with Cancel / Resume / End now.
- **Billing page (`/billing`, design system):**
  - **Current plan card:**
    - "Free";
    - "Pro monthly · renews 7 Dec";
    - "Pro · cancelled, active until 7 Dec";
    - "Exam Pass · active until 7 Dec (30 days left)";
    - "Exam Pass expired".
    - Plus usage for free users: documents x/3, flashcards x/50, quizzes this week x/2, from `checkLimit`.
  - **Three plan cards:**
    - **Free**: the limits from `FREE_LIMITS`.
    - **Pro**: a Monthly/Yearly toggle showing the yearly saving; unlimited uploads, chat with your notes, the exam planner.
    - **Exam Pass**: once, Pro for 30 days.
    - The current plan is marked. Buttons are disabled when they don't apply (for example, a Pro subscriber can't buy Pro again, but can still buy an Exam Pass).
  - No mock exams (v2).
  - Cards stack on phones and sit 3 across from `lg`. 44px targets.
- **Sidebar:** `UpgradeIsland` uses `hasProAccess`, so Pro users no longer see "Upgrade to Pro".
- **`npm run dev:pro`** keeps working, and `on` also replaces a cancelled mock pass.

## Files
- **New:**
  - `lib/billing/apply.ts`, `lib/billing/actions.ts`, `lib/billing/queries.ts`
  - `components/billing/plan-cards.tsx`, `components/billing/current-plan.tsx`, `components/billing/mock-checkout-dialog.tsx`
- **Edit:** `app/(app)/billing/page.tsx`, `app/(app)/layout.tsx`, `lib/plans.ts`, `.env.example`.
- No new packages.

## Security
- Every action re-checks the user. The mock is refused in production unless explicitly enabled.
- State changes only happen in `lib/billing/apply.ts` (server), and the browser never writes plan state directly.
- Access is still only through `hasProAccess` (test/live aware).

## Acceptance criteria
- Free → Pro monthly (mock) → the page shows "Pro monthly · renews …", the sidebar Upgrade card disappears, and Chat and the Planner unlock.
- Cancel → "active until …" and Pro stays. Resume → active again. End now → Free, and Pro features lock.
- Exam Pass → "active until +30 days". Buying a second pass extends it to +60.
- With `VERCEL_ENV=production` and no override, the mock action is refused.
- The billing page works at 320–1920.

## Checks
- `tsc`, lint, build.
- Unit tests for the Exam Pass expiry and the status → view mapping.
- A dev-branch script for each `apply*` and mock action, checking `hasProAccess` after each.
- Headless Chrome screenshots of `/billing` (free and Pro) at 375 and 1440.

## Manual test
1. Sidebar → **Billing** → **Get Pro monthly** → the mock checkout → **Pay (test)** → "Pro monthly · renews …".
2. Open a subject → Chat works. The sidebar no longer says "Upgrade to Pro".
3. **Manage billing** → Cancel → "active until …" → Resume.
4. **End now** → back to Free, and Chat shows the upgrade card.
5. Buy the **Exam Pass** → "active until …".

## Implementation notes (after building)
- **The first draft** (a real Lemon Squeezy checkout + webhook) was declined: "the implementation of lemon squeezy not now, mock the payment". This file was rewritten to the mock version and approved.
- **`lib/billing/apply.ts`** (`applySubscription`, `applyOrder`, `refundOrder`, `syncPlanCache`) is the only writer of billing state. **The Lemon Squeezy webhook should call these later:**
  - map `subscription_*` events to `applySubscription` (Lemon Squeezy subscription id as `externalId`);
  - map `order_created` for the Exam Pass variant to `applyOrder` (order id);
  - map `order_refunded` to `refundOrder`;
  - match the user only by `meta.custom_data.user_id`;
  - verify `X-Signature` (HMAC-SHA256 hex of the raw body, compared timing-safe) and dedupe on a hash of the body.
- **Pure rules** in `lib/billing/rules.ts`:
  - The Exam Pass end is the later of now and the current pass's end, plus 30 days.
  - Month/year renewal dates are clamped: 31 Jan → 28 Feb.
- **Tests:**
  - Rules unit test.
  - Apply functions on the seed user: subscribe → cancelled (Pro until renewal) → expired → pass 30 days → second pass 60 days → a replayed order ignored → refunds back to Free. Cleaned up afterwards.
  - Headless Chrome on the user's account: Free → Get Pro monthly → Pay (test) → "Pro · monthly, renews 7 Dec 2026", and the sidebar Upgrade card is gone → Cancel → "Cancelled. Pro stays active until…" → End now → Free, and the Upgrade card is back. No sideways scroll at 375px.
  - The user's original (cancelled) `dev-mock-pass` row was left untouched; the mock rows were deleted.
- **The Next dev "1 Issue" badge** in the test screenshots came from the headless test sending its Authorization header to Clerk's CDN (a CORS preflight failure). It's a test-harness artifact, not an app error.
