# Vappi

Students upload their own course files; AI turns them into summaries, flashcards, quizzes and a day-by-day plan until the exam. See `AGENTS.md` for the product rules and `prompts/` for every implemented change.

## Stack

Next.js (App Router, Cache Components) · Tailwind CSS · Clerk · Neon Postgres + pgvector · Prisma 7 · Zod

## Setup

```bash
npm install                     # also runs `prisma generate`
cp .env.example .env.local      # then fill in, or let the CLIs write it:
npx clerk@latest env pull       # Clerk keys
neon checkout dev               # Neon DATABASE_URL / DATABASE_URL_UNPOOLED for the dev branch
npm run dev
```

Other devices on your network: `npm run tunnel` (HTTPS URL; sign-in needs HTTPS off `localhost`).

## Database

- The app uses the **pooled** `DATABASE_URL`. Prisma CLI / migrations use the **direct** `DATABASE_URL_UNPOOLED`.
- Work and migrate on the Neon **`dev` branch only**. Never run migrations or tests against `production`.
- `npx prisma migrate dev --name <change>` (dev) · `npx prisma migrate deploy` (deploy pipeline).

## Troubleshooting

**The page keeps reloading by itself (dev only).** The terminal prints `✓ Compiled in 0ms` again and again, and the browser console shows a reload each time. This is a stale or half-cleared Next.js dev cache (the dev server answers every page with "HMR hash mismatch"). Fix:

1. Stop the dev server (Ctrl+C).
2. `npm run dev:clean`: deletes `.next` completely and starts the dev server again. It refuses while a dev server is still running.
3. Open the app in **one** tab.

Never delete `.next` while `npm run dev` is running. On a phone, use `npm run tunnel` rather than the LAN address (`http://192.168.x.x:3000`), because Clerk sign-in needs HTTPS off `localhost`.
