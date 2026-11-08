# 03 — Clerk authentication

## Goal
Add Clerk auth to Vappi using the existing Clerk application **app_3LhhifI250ZVB9KT5YWZfQpsNvk**, which was selected in the Clerk Dashboard. Sign-in and sign-up pages match the app's dark design. Every route except the marketing home, the auth pages, and future legal and webhook routes is protected. The top bar shows the signed-in user's button.

## Docs read
- `AGENTS.md` (sections 2, 5, 7, 12, 13)
- Clerk setup instructions (the pasted CLI setup guide), plus the Clerk Next.js rules: `proxy.ts` on Next 16, `ClerkProvider` inside `<body>`, `await auth()`, and Suspense with `cacheComponents`
- `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`
- `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`: session reads must sit behind `<Suspense>`, otherwise the build fails

## Code inspected
- `package.json`: no auth libraries (no next-auth, Better Auth, Supabase, or Firebase). Next 16.4.5, React 19.3, npm (`package-lock.json`). Node v24.21.0.
- No `proxy.ts` / `middleware.ts`, no `app/sign-in` or `app/sign-up`, no `.clerk/`.
- `next.config.ts` has `cacheComponents: true`.
- `app/layout.tsx` (fonts, `ToastProvider`), `app/page.tsx` (temporary home), `components/layout/app-shell.tsx` / `topbar.tsx` (actions slot with the initials avatar), `app/design-system/page.tsx`.
- Env files were not read (per the Clerk rules).

## Decisions
1. Run `npx -y clerk@latest init --app app_3LhhifI250ZVB9KT5YWZfQpsNvk --no-skills`. The Clerk skills are already installed for this agent. Let `init` detect Next.js and npm. Do not create an accountless app. If a CLI command needs account access, ask the user to run `npx -y clerk@latest auth login` in their own terminal.
2. After `init`, review what it generated and adjust it to these rules:
   - `proxy.ts` (Next 16 name) with `clerkMiddleware`. Public routes: `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/api/webhooks(.*)`, `/legal(.*)`. Everything else calls `auth.protect()`. `/design-system` stays dev-only and is also protected.
   - `ClerkProvider` goes inside `<body>` in `app/layout.tsx`, wrapping `ToastProvider`.
   - Catch-all `app/sign-in/[[...sign-in]]/page.tsx` and `app/sign-up/[[...sign-up]]/page.tsx`, each wrapped in `<Suspense>`, centered on the app background with the Vappi logo above the card.
3. **Look**: a Clerk `appearance` object built from our tokens: `bg`/`surface` backgrounds, `border` lines, `fg`/`fg-muted` text, Plus Jakarta Sans, `radius-control`, the white primary button like "Upgrade", and dark inputs like our `Input`. No new UI library and no `@clerk/themes` (shadcn isn't used). Clerk's built-in localization is set from the html `lang`; full FR/EN/AR UI language arrives with the i18n prompt.
4. **Auth controls**:
   - Home page (`/`): `<Show when="signed-out">` with `SignInButton` (secondary) and `SignUpButton` (primary), and `<Show when="signed-in">` with "Open Vappi" and a `UserButton`, all inside `<Suspense>`.
   - App top bar (`AppShell` in the design-system page for now): replace the initials `Avatar` with Clerk's `<UserButton />`, inside `<Suspense>` with a skeleton fallback.
5. **Not in this prompt**: the Clerk `user.created` webhook that creates the Prisma `User` (it needs the database; it comes with the DB prompt), the onboarding fields (language, time zone), and Organizations (out of MVP scope; I won't offer to enable them).
6. Keep `.env.example` as the canonical list: add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=`, `CLERK_SECRET_KEY=`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`, all with empty values. Real keys stay in the env file `init` writes, which is git-ignored. I never print or read them.

## Files expected
- New: `proxy.ts`, `app/sign-in/[[...sign-in]]/page.tsx`, `app/sign-up/[[...sign-up]]/page.tsx`, `lib/clerk-appearance.ts`, `.env.example`
- Edited: `app/layout.tsx`, `app/page.tsx`, `app/design-system/page.tsx`, `package.json`/lock (`@clerk/nextjs`), possibly `.gitignore` (make sure `.env*` and `.clerk/` are ignored)

## Security
- `CLERK_SECRET_KEY` is server only. Only the publishable key carries the `NEXT_PUBLIC_` prefix.
- Protection runs in `proxy.ts` and will be re-checked in every server action and route later (AGENTS §5).
- The webhook path is public at the proxy level but must verify its signature (future prompt).
- Env files and the `.clerk/` claim files are never read or printed.

## Acceptance criteria
- `npx -y clerk@latest doctor` reports no blocking issues.
- Signed out: `/` shows Sign in / Sign up. `/design-system` redirects to `/sign-in`.
- Sign-up and sign-in work with the selected app. After sign-in, the `UserButton` shows in the home and the top bar, and sign-out returns to signed-out.
- The sign-in and sign-up pages match the dark UI and also work at 375px width and in RTL.
- `tsc`, lint, and `next build` pass (no "request data outside Suspense" errors).

## Checks
`npx -y clerk@latest doctor`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, and the running dev server: signed-out redirects, the sign-in page renders, and with a test user (only with your OK, using a `+clerk_test` email and code 424242) the sign-in flow and the UserButton.

## Manual test
1. `npm run dev`, open `/`: you see Sign in / Sign up.
2. Open `/design-system` while signed out: you are redirected to `/sign-in`.
3. Sign up with your email: you return signed in, and the profile icon shows.
4. Open `/design-system`: the top bar shows your Clerk avatar menu. Sign out: you are back to signed out.
5. Check the sign-in page at 375px and with `dir="rtl"`.

## Revision during implementation (2026-11-05)
- **Route protection pattern changed.** Clerk's Next.js skill says `createRouteMatcher` is deprecated in `@clerk/nextjs` 7. So `proxy.ts` stays bare (`clerkMiddleware()`, as generated by `init`), and each protected resource calls `await auth.protect()` itself. `/design-system` does this, with a `loading.tsx` because the page reads the request. Every future page, route handler, and server action must do the same.
- `init` wrote the keys to `.env.local` (git-ignored; not read). `.clerk/` was added to `.gitignore`, and `.env.example` is un-ignored so it can be committed.
- `clerk doctor`: all checks pass. Production instance not configured yet (expected).

## Fixes after user report: "Sign In doesn't work in Firefox" (2026-11-05)
- **Cause 1:** the app was opened at `http://192.168.11.129:3000`. Next.js blocks dev scripts for non-localhost origins, so the page never hydrated and buttons did nothing. **Fix:** `allowedDevOrigins` in `next.config.ts` now auto-includes this PC's LAN IPv4 addresses, plus `*.trycloudflare.com`.
- **Cause 2:** plain-http LAN addresses aren't a secure context, so `crypto.subtle` is missing and Clerk logs "Suffixed cookie failed" and an infinite redirect loop on session refresh. This is a browser rule. **Fix:** use `http://localhost:3000` on this PC. For other devices, use `npm run tunnel` (Cloudflare quick tunnel, HTTPS).
- **Bug found while testing:** the Clerk profile menu card was transparent, so page content showed through. **Fix:** `elements.userButtonPopoverCard` uses a solid surface background.
- Test user `vappi-qa+clerk_test@example.com` was created with the user's OK for end-to-end tests.
