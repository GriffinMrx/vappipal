# 04 — Neon Postgres + Prisma

## Goal
Connect Vappi to the Neon project `snowy-wind-31922271` (org `org-muddy-boat-95260340`) with the Neon CLI, then wire Postgres into the app with Prisma: a server-only client, pooled connection for the app, direct connection for migrations, and the pgvector extension enabled. Prove the connection end to end in the running app.

## Docs / skills read
- `AGENTS.md`: §5 (server-only Prisma, every query scoped to the Clerk user), §6, §8 (User model), §12 (pgvector as `Unsupported("vector(N)")`, `CREATE EXTENSION IF NOT EXISTS vector` in a migration, pooled URL for the app and direct URL for migrations, cold starts, **separate dev branch: never migrate or test on production**), §13
- Neon skills `neon` and `neon-postgres`: `neon init` / `neon deploy` / `neon checkout`, env pull writes `DATABASE_URL` (pooled) + `DATABASE_URL_UNPOOLED` (direct), Vercel uses `node-postgres` + `attachDatabasePool`, migrations use the direct URL, branch-first dev flow
- Prisma 7 docs (looked up during implementation): `prisma.config.ts`, the `prisma-client` generator, `@prisma/adapter-pg`

## Code inspected
- No DB code, Prisma, or `neon.ts` yet. No `.neon` link.
- `.env.local` exists (Clerk keys from `clerk init`). Not read: Neon's env pull merges its own variables into it.
- Neon CLI 8.16.1 installed globally; latest is 8.23.2.
- npm latest versions: `@prisma/client` / `@prisma/adapter-pg` 7.10.1; the `prisma` CLI `latest` tag points to `8.0.0-rc.30`. **I'll pin 7.10.1 (stable, matching the client), not the release candidate.**

## Steps
1. `npm i -g neon@latest`. If that fails, use `npx neon@latest`. If a command opens browser sign-in, I'll ask you to finish it there, or to run `neon login`.
2. Run exactly what you gave: `neon init -y --org-id org-muddy-boat-95260340 --project-id snowy-wind-31922271 --branch production --services postgres`. This links the repo and writes `neon.ts` (Postgres only).
3. `neon deploy`. Postgres is the only declared service, so this is a reconciliation of the production branch, plus an env pull.
4. **Dev branch (AGENTS §12):** `neon checkout dev --create`. `.neon` then points at the `dev` branch and `.env.local` holds the **dev** branch's `DATABASE_URL` / `DATABASE_URL_UNPOOLED`. All migrations and tests run on `dev`. Production is only migrated later through a deploy pipeline.
5. **Prisma wiring:**
   - `npm i @prisma/client@7.10.1 @prisma/adapter-pg@7.10.1 pg @vercel/functions` and `npm i -D prisma@7.10.1 @types/pg`
   - `prisma.config.ts`: schema path, migrations path, and the migration URL `DATABASE_URL_UNPOOLED` (direct). Prisma CLI env loading reads `.env.local`.
   - `prisma/schema.prisma`: `prisma-client` generator (output `lib/generated/prisma`, git-ignored), `postgresql` datasource with the `postgresqlExtensions` preview feature and `extensions = [vector]`. **Minimal first model `User`** per §8: `id` = Clerk user id, `email`, `name`, `language` (enum FR/EN/AR, default FR), `timeZone` (default `Africa/Casablanca`), `plan` (enum FREE/PRO, default FREE), `createdAt`. The other §8 models come with their own feature prompts.
   - The first migration (`prisma migrate dev --name init`) creates the extension (`CREATE EXTENSION IF NOT EXISTS vector`) and the `User` table on the **dev** branch.
   - `lib/db.ts` (`import "server-only"`): one `pg` `Pool` on the pooled `DATABASE_URL`, registered with `attachDatabasePool` (Vercel Fluid), wrapped in `PrismaPg` and a singleton `PrismaClient` (hot-reload safe). Connection timeout is long enough for Neon cold starts (§12).
6. **Proof endpoint**: `app/api/health/db/route.ts`, Node runtime.
   - Requires sign-in (`await auth.protect()`) and returns 404 in production.
   - Runs `SELECT 1` with timing, reads `current_database()`, the server version, the Neon branch host (hostname only, no credentials), whether the `vector` extension is installed, and `prisma.user.count()`.
   - Also does a round trip on the **signed-in user's own row**: upsert `User` by Clerk id (email from Clerk), read it back, and return it. This proves Clerk → server → Prisma → Neon and is scoped to that user only.
7. `.env.example`: add `DATABASE_URL=` and `DATABASE_URL_UNPOOLED=` with comments (pooled vs direct). `.gitignore`: add `lib/generated/`. Make sure `.neon` is ignored.

## Security
- Database URLs are server-only (no `NEXT_PUBLIC_`). `lib/db.ts` is `server-only`.
- The health route returns no secrets, only the hostname and booleans and counts, is behind Clerk, and returns 404 in production.
- No test or migration touches the production branch.
- I won't print or read env values. I verify by behavior (and `neon env` status output, which shows variable names only).

## Acceptance criteria
- `neon status` shows the project linked. `.neon` is on branch `dev`.
- `prisma migrate dev` applies `init` on dev, and `prisma migrate status` reports it up to date.
- `npm run build`, `tsc`, and lint pass.
- In the running app, signed in as the test user, `GET /api/health/db` returns `ok: true`, `vector: true`, latency, and the user's upserted row. Signed out, it redirects to sign-in or returns 401/404, never data.
- `clerk doctor` still passes (the Clerk keys survive the Neon env pull).

## Checks
`neon status`, `npx prisma migrate status`, `npx prisma validate`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `clerk doctor`, plus a browser run of `/api/health/db` signed in (test user) and signed out.

## Manual test
1. `npm run dev`, sign in, open `http://localhost:3000/api/health/db`: you see `ok: true`, `vector: true`, and your user row.
2. Sign out, then open the same URL: you're sent to sign-in.
3. `npx prisma studio`: the `User` table on the dev branch has your row.

## Implementation notes (2026-11-05)
- Neon CLI 8.23.2, already signed in (no browser step). `neon init` linked the project and wrote `neon.ts`. `neon deploy` made no changes to production.
- `neon.ts` edit: the generated policy gave **every** new branch `ttl: "7d"`, which would delete `dev` after a week. `dev` is now exempt, and other new branches keep the 7-day TTL.
- `neon checkout dev --create` → branch `dev` (br-dawn-block-baml67id), host `ep-ancient-sky…`. Production (br-rapid-waterfall-baxp1a3q) is `ep-twilight-fire…`. I checked the migration target host before applying.
- Prisma 7 removed `directUrl`: `prisma.config.ts` uses `DATABASE_URL_UNPOOLED` for the CLI (loaded with `@next/env`'s `loadEnvConfig`, so `.env.local` works). `lib/db.ts` uses the pooled `DATABASE_URL`.
- pgvector is enabled with a raw `CREATE EXTENSION IF NOT EXISTS vector` at the top of the `init` migration (no preview feature).
- Added a `postinstall: prisma generate` script, because the generated client is git-ignored and Vercel needs it at build time.
- `prisma migrate diff --from-migrations` needs `shadowDatabaseUrl` in Prisma 7. I skipped it (`migrate status` is clean).
- `neon diff production` confirms production has none of the new objects.
