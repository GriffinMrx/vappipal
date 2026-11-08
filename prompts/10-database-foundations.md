# 10 — Database foundations for the real features

## Goal
Finish the data layer so the next feature prompts (upload → processing → study material, flashcard review, quizzes, chat, planner, reminders, billing) can be built straight on it, with no more schema guessing. That means: complete the schema, migrate the Neon `dev` branch, add the vector index, and add the small server modules every feature needs (plan limits, Pro access, vector search, Clerk user sync). No feature UI in this prompt.

## Docs and code read
- AGENTS.md §5, §7, §8, §9, §10, §12, §13.
- `prompts/04-neon-postgres-prisma.md`: Prisma 7 with `prisma.config.ts` (CLI on `DATABASE_URL_UNPOOLED`), the app on the pooled `DATABASE_URL` through `lib/db.ts`, migrations only on Neon branch `dev`.
- `prisma/schema.prisma` + the 3 migrations: every §8 model already exists (User, Subject, Document, Chunk with `vector(1536)`, Summary, Flashcard with SM-2 fields, Question, Attempt, StudyPlanDay, Subscription, UsageEvent). pgvector is enabled. There's **no** vector index yet.
- `lib/auth/current-user.ts`: creates the User row on first visit as a safety net, and says the Clerk webhook "is the real creator" — **that webhook doesn't exist yet**.
- `lib/subjects/actions.ts`, `lib/user/actions.ts`, `lib/dates.ts` (time-zone day helpers), `.env.example`, `neon.ts`.
- During implementation: the Clerk webhooks skill (`verifyWebhook`), the Prisma raw query docs, and the pgvector HNSW docs.

## What's missing for the real features (and the fix)

### 1. Schema additions (one migration: `foundations`)
| Need | Change |
|---|---|
| §7/§9: each AI step runs on its own, a failure shows on its own, retry works | New `DocumentStep` table: `documentId`, `step` (enum `EXTRACT`, `EMBED`, `SUMMARY`, `FLASHCARDS`, `QUIZ`), `status` (enum `PENDING`, `RUNNING`, `DONE`, `FAILED`), `error`, `attempts`, `updatedAt`. Unique on `(documentId, step)`. `Document.status` stays the overall Processing / Ready / Failed. |
| §9: large files in page batches, real progress | `Document.pagesProcessed Int @default(0)` and `Document.ocrUsed Boolean @default(false)` |
| Inngest retries must not duplicate chunks | `Chunk.index Int` (order in the document), unique on `(documentId, index)` |
| SM-2 needs a review history | `Flashcard.lastReviewedAt DateTime?`, `Flashcard.lapses Int @default(0)`, plus an index on `(subjectId, nextReviewAt)` for "due cards in this subject" |
| §7: short answers graded by AI with a reason | `Attempt.feedback String?` |
| Chat with your course: optimistic send, history, cited pages | New `ChatMessage`: `userId`, `subjectId`, `role` (enum `USER`, `ASSISTANT`), `content`, `citations Json` (`[{ documentId, page }]`), `clientId String?` (makes an optimistic retry idempotent: unique on `(userId, clientId)`), `createdAt`. Index on `(subjectId, createdAt)`. |
| §10: one reminder a day, unsubscribe link without signing in | `User.lastReminderOn DateTime? @db.Date` (the student's calendar day it was sent), `User.unsubscribeToken String @unique @default(cuid())` |
| Billing portal + never mixing test and live | `User.lemonSqueezyCustomerId String?`, `Subscription.testMode Boolean` |
| Webhooks are retried by Clerk and Lemon Squeezy | New `WebhookEvent`: `source` (enum `CLERK`, `LEMON_SQUEEZY`), `eventId`, `receivedAt`. Unique on `(source, eventId)`. Insert first; a duplicate means it's already handled. |

Nothing is renamed or dropped, so existing data and code keep working. The dev branch only holds test data; existing rows get the defaults (`Chunk.index` is filled with a row number in the migration before it becomes required).

### 2. Vector index
In the same migration, raw SQL: `CREATE INDEX "Chunk_embedding_hnsw_idx" ON "Chunk" USING hnsw (embedding vector_cosine_ops);`. §12 says to add it "once there is real data". An empty HNSW index costs nothing and saves a step later. Prisma doesn't model this index. I'll check with `prisma migrate diff` that later migrations don't try to drop it. If they do, I'll document the workaround in the schema comment.

### 3. Server modules (all `import "server-only"`)
- `lib/plans.ts`: plan limits read from env with Zod and these defaults: Free has 3 documents, 50 flashcards, 2 quizzes a week. Pro is unlimited. Plus the Lemon Squeezy variant ids (`LEMONSQUEEZY_VARIANT_PRO_MONTHLY`, `…_PRO_YEARLY`, `…_EXAM_PASS`). No numbers hard-coded in components.
- `lib/billing/access.ts`: `hasProAccess(userId)`, the one helper from §7. It's true for an active, on-trial, or cancelled-but-not-yet-ended subscription, or an Exam Pass whose `endsAt` is in the future, and test-mode rows only count when the app runs in test mode.
- `lib/limits.ts`: `checkLimit(userId, "document" | "flashcards" | "quiz")` returns `{ allowed, limit, used }`, so the UI can show the limit and the upgrade option (§11). Quizzes are counted from `UsageEvent` over the last 7 days. Documents and flashcards are counted from their own tables.
- `lib/search/vector.ts`: `searchChunks({ userId, subjectId, embedding, limit })`. One `$queryRaw` tagged template, **always** `WHERE "userId" = … AND "subjectId" = …`, cosine distance `<=>`, and it returns `{ id, documentId, page, text, distance }`. Plus `saveChunkEmbedding(chunkId, userId, embedding)` (a raw `UPDATE`, also scoped by user). The embedding length is checked against `EMBEDDING_DIMENSIONS = 1536`.
- `app/api/webhooks/clerk/route.ts`: verified with Clerk's `verifyWebhook` (signing secret `CLERK_WEBHOOK_SIGNING_SECRET`), deduped via `WebhookEvent`. `user.created` / `user.updated` upsert the User (email, name), and `user.deleted` deletes the User (cascades remove all their data). The route is public in `proxy.ts` (verified by signature, not by session). The first-visit safety net in `current-user.ts` stays.

### 4. Dev seed (dev branch only)
`scripts/seed-dev.mjs` (`npm run db:seed`) refuses to run unless `NEON_BRANCH` is set and isn't the production branch. Given a Clerk user id (`npm run db:seed -- user_…`), it creates one sample subject with an exam date, one Ready document, its chunks (no embeddings), a summary, 6 flashcards (some due), 4 questions with source pages, and plan days. That gives every next UI feature real-looking data before the pipeline exists. It's idempotent: it deletes and rebuilds only the "Sample: Cell biology" subject for that user.

### 5. Env
`.env.example` gets `CLERK_WEBHOOK_SIGNING_SECRET`, `FREE_MAX_DOCUMENTS`, `FREE_MAX_FLASHCARDS`, `FREE_MAX_QUIZZES_PER_WEEK`, `LEMONSQUEEZY_TEST_MODE`, and the 3 variant ids, all empty with comments.

## Assumptions
- Embeddings: **1536 dimensions** (OpenAI `text-embedding-3-small`), as the existing schema already says. Claude has no embeddings API. A different model means changing the vector size and re-embedding (§12). The model name lives in env, in the pipeline prompt.
- No `Quiz` grouping table: the reference design doesn't need one yet (§8).
- No new npm dependencies.

## Files
- `prisma/schema.prisma`, new `prisma/migrations/<ts>_foundations/migration.sql`
- New `lib/plans.ts`, `lib/billing/access.ts`, `lib/limits.ts`, `lib/search/vector.ts`, `app/api/webhooks/clerk/route.ts`, `scripts/seed-dev.mjs`
- Edit `proxy.ts` (public webhook route), `package.json` (`db:seed` script), `.env.example`

## Security
- Every new query is scoped by `userId`. The vector query filters by user **and** subject, uses tagged-template parameters only, and never uses `$queryRawUnsafe`.
- The Clerk webhook rejects anything without a valid signature, before any DB work. It logs no email or name.
- `unsubscribeToken` is random and unique, and it only allows turning reminders off.
- Only the webhook (the next billing prompt) writes `Subscription` or `plan`. `hasProAccess` only reads them.
- The migration and seed run only on the `dev` branch. Before migrating, I check that the target host is the dev endpoint (`ep-ancient-sky…`).

## Acceptance criteria
- `prisma migrate dev --name foundations` applies on `dev`. `prisma migrate status` reports it up to date, and `prisma validate` passes.
- The HNSW index exists (`\d "Chunk"` or a `pg_indexes` query), and a fresh `prisma migrate diff` shows no drift.
- `searchChunks` returns only the given user's and subject's chunks. This is tested with two users' chunks that carry known vectors.
- `hasProAccess`: false for Free, true with an active subscription, true with an Exam Pass expiring tomorrow, false with one that expired yesterday.
- `checkLimit` reports the correct used and limit numbers for Free and Pro.
- The Clerk webhook returns 400 on a bad signature, and creates, updates, and deletes the user on valid events. A replayed event is a no-op.
- The seed creates the sample subject. The app shows it on Home and Subjects, and existing pages still work.
- `tsc`, lint, and build pass.

## Checks
`npx prisma validate`, `npx prisma migrate dev --name foundations`, `npx prisma migrate status`, `npx prisma migrate diff` (drift), `npx tsc --noEmit`, `npm run lint`, `npm run build`. Plus a temporary script against the dev branch that tests `searchChunks` isolation, `hasProAccess`, and `checkLimit`, then cleans up its rows. The Clerk webhook gets a bad-signature request locally. A real signed event needs a tunnel plus the webhook set up in the Clerk dashboard (steps below).

## Manual test
1. `npx prisma studio`: the new tables `DocumentStep`, `ChatMessage`, and `WebhookEvent`, and the new columns, exist on the dev branch.
2. `npm run db:seed -- <your Clerk user id>`, then `npm run dev`. "Sample: Cell biology" shows on Home and Subjects with its exam date.
3. Run `npm run db:seed` again: there's still only one sample subject.
4. Clerk webhook: `npm run tunnel` → Clerk dashboard → Webhooks → add `<tunnel>/api/webhooks/clerk` with events `user.created`, `user.updated`, `user.deleted` → copy the signing secret into `.env.local` as `CLERK_WEBHOOK_SIGNING_SECRET` → restart dev. Sign up a new test user: their row appears in `User`. Change their name in Clerk: the row updates. Delete them: the row and their data are gone.
5. `curl -X POST localhost:3000/api/webhooks/clerk -d '{}'` → 400.
