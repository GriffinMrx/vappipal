# 39 · Production hardening pass (cleanup, performance, security, bugs)

## Goal
Make the app ready for production without changing what users see or do: remove dead code, cut client JS, add secure headers, and fix bugs found in the audit. Anything that could change behavior is listed under "Needs a decision" and is done only if the user approves it.

## Docs read
- AGENTS.md (all), `node_modules/next/dist/docs/.../next-config-js/headers.md`, `poweredByHeader.md`.

## What I inspected
- `package.json`, `next.config.ts`, `proxy.ts`, `.env.example`, `.gitignore`.
- All 8 route handlers and all 13 `"use server"` files: every one checks the signed-in user, scopes queries by `userId`, and validates input with Zod.
- `lib/search/vector.ts`: only tagged `$queryRaw`/`$executeRaw`, always filtered by user and Space. No `$queryRawUnsafe`.
- Upload flow (`lib/documents/actions.ts`, `lib/storage.ts`): key pinned per user and Space, size, MIME and magic-byte checks, 5-minute signed URLs. Good.
- Secret scan (Clerk, Gemini, Resend, AWS, Postgres URL patterns) of all source: **no hardcoded secrets**. `.env*` is gitignored and `.env.example` is complete.
- No `dangerouslySetInnerHTML`, `eval` or `new Function`.
- Bundle: `.next/static/chunks` after a baseline build.

## Baseline (before)
- `tsc --noEmit`: 0 errors. `eslint`: 0 problems. No test suite exists in the repo.
- `next build`: passes in 13 s (wall clock).
- Client JS total: 3,784,593 bytes.
- `recharts` chunk (351,756 B) is in the client manifest of **every** signed-in page (home, spaces, space, create, document, planner, billing, settings).
- `npm audit`: 17 (15 moderate, 2 high).

## Findings and planned changes (safe: no behavior change)

### Bugs
1. **Unhandled rejection when the browser leaves while Create is writing.** In `app/api/spaces/[spaceId]/creations/route.ts` and `.../creations/[creationId]/edit/route.ts`, `controller.close()` is called without a guard. After the client disconnects the stream is cancelled, and `close()` throws `ERR_INVALID_STATE` (reproduced in Node). This happens exactly in the case the route is built for (user leaves, the creation is still saved). Fix: a `closeQuietly()` that swallows the throw, like the chat route already does. The edit route can also call `close()` twice (once at abort, once at the end); the guard covers that.

### Cleanup
2. Delete `components/layout/coming-next.tsx`: no imports anywhere (grep for the path and `ComingNextPage`).
3. Fix the stale comment in `lib/search/vector.ts` ("text-embedding-3-small" → the model comes from `EMBEDDING_MODEL`).
4. Remove the `/* config options here */` placeholder in `next.config.ts`.
- All npm dependencies are used (checked every package against imports). None removed.

### Performance
5. **Stop shipping Recharts on every page.** `app/(app)/layout.tsx` imports `NewSpaceButton`, `SidebarSpacesLive` and `SpaceSwitcher` from `components/spaces/space-views.tsx`, and the same file holds `HomeStats` → `StatChartCard` → `recharts`. Move `HomeStats` (and the `GoalPlanChart` type) into a new `components/home/home-stats.tsx` and import it from there in `app/(app)/home/page.tsx`. Pure file move: same markup and props.
6. Space page Files tab: start `getUploadAllowance()` in the same `Promise.all` as documents and counts instead of after them (one less database round trip on the default tab). Same data.

### Security
7. Secure headers on every response (`next.config.ts` `headers()`):
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin` (the file route keeps its own `no-referrer`)
   - `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'` (clickjacking; nothing frames the app)
   - `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()` (none of these APIs are used; clipboard is untouched)
   - `Strict-Transport-Security: max-age=63072000; includeSubDomains` (browsers ignore it on http://localhost)
8. `poweredByHeader: false` (stop advertising Next.js).

## Needs a decision (only if approved)
- A. **Protect pages in `proxy.ts`** (AGENTS.md §5 says auth is wired through middleware). Today pages rely on `auth.protect()` inside each data island, so a signed-out visitor gets the static shell first, then a redirect. With this, `/home`, `/spaces/**`, `/planner`, `/billing`, `/settings` redirect to sign-in in the proxy. API routes, webhooks, Inngest, `/`, `/sign-in`, `/sign-up`, `/unsubscribe` stay as they are (APIs keep their own 401/404).
- B. `overrides: { "pptx-preview": { "uuid": "^11.1.1" } }`: fixes the `uuid` advisory. `uuid` keeps the same `v4()` API.
- C. `overrides: { "pptx-preview": { "echarts": "^6.1.0" } }`: fixes the ECharts XSS advisory, but it is a major version under a library built for v5. Charts inside PowerPoint previews could break.
- D. Delete 5 icons that nothing references: `bold-download`, `bubble-chat-alert`, `bubble-chat-delete`, `reminder`, `two-slider-vertical` (user-supplied assets), then re-run `npm run icons`.

## Found, not fixing (and why)
- `zod@3.25.76` inside `inngest` (high): no patched 3.x exists, and the latest `inngest` (4.26.2) still requires zod 3. Forcing zod 4 could break job validation. Exposure is low because Inngest only validates its own signed payloads.
- `glob` / `minimatch` / `rimraf` / `gaxios` (moderate): these come in through Inngest's OpenTelemetry GCP detector and ESLint. They are dev-time tools or code paths the app never runs, and the only "fix" npm offers is a downgrade.
- `eslint-config-next` / `typescript-eslint` (moderate): dev-only. npm's fix is a downgrade to Next 15.
- Full Content-Security-Policy (script/style sources): needs nonces for Clerk and inline styles. That is a real behavior risk without a full test pass. I only add `frame-ancestors`.
- Per-request caching of `hasProAccess`: it looks like a quick win (called 2 or 3 times per page), but a billing server action writes and then re-renders in the same request, so a cached value would be stale. Not safe.
- Mock checkout is refused only when `VERCEL_ENV=production`. A non-Vercel production host would allow it. The app is Vercel-only and billing is the last feature, so this is flagged and not changed.
- No automated test suite exists, so "pass existing tests" means type check, lint, build and manual checks.

## Files expected to change
- `app/api/spaces/[spaceId]/creations/route.ts`, `app/api/spaces/[spaceId]/creations/[creationId]/edit/route.ts`
- `components/spaces/space-views.tsx`, new `components/home/home-stats.tsx`, `app/(app)/home/page.tsx`
- `app/(app)/spaces/[spaceId]/page.tsx`
- `next.config.ts`, `lib/search/vector.ts`
- deleted: `components/layout/coming-next.tsx`
- if approved: `proxy.ts`, `package.json`/`package-lock.json`, `assets/icons/*`, `components/icons/generated.tsx`

## Acceptance criteria
- Type check, lint and build pass. Routes and their rendering modes are unchanged.
- The Recharts chunk is no longer in the client manifest of non-Home pages.
- Responses carry the headers above, with no `x-powered-by`.
- Create: leaving mid-write still saves the creation and logs no unhandled rejection.
- Every page looks and works exactly as before.

## Checks to run
- `npx tsc --noEmit`, `npx eslint`, `npx next build` (timed), client JS size per route, `npm audit`.
- `curl -I` on `/`, `/home`, and an API route for the headers.
- In the running app: Home charts render, the sidebar Space list/switcher/New Space work, the Files tab shows the upload allowance, and a Create stream completes; then start one, close the tab, and check that it is saved.

## Manual test steps
1. `npm run dev`, sign in, open Home: the three charts and the plan show as before.
2. Open Spaces and a Space; the Files tab shows the files and "x of y" uploads; switch tabs.
3. Create → Notes → let it finish. Start another and close the tab mid-write; reopen the Space: it is listed (unfinished or ready).
4. DevTools → Network → any page: response headers include `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and no `X-Powered-By`.
