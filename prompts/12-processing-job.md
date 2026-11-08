# 12 — Feature 2: The processing job (file → pages → chunks → embeddings)

Second feature in the series. When an upload finishes, a background **Inngest** job reads the file page by page (slide by slide for PowerPoint), splits the text into small chunks that keep their page number, gives each chunk an embedding, and marks the document **Ready**, or **Failed** with a clear reason and a **Retry** button. The subject page shows live progress. AI-written study material (summary, flashcards, quiz) is the **next** prompt.

## Docs and code read
- AGENTS.md §5 (processing never runs inside a request), §7 (mocks now, real providers later), §9 steps 2–4 and 6, §12 (Vercel time limits, scanned PDFs → OCR, OCR keeps page refs, document text is untrusted, batches of pages, cost caps per plan, verify Inngest with its signing key, vector size fixed at 1536), §13 (Inngest dev server).
- Memory: Inngest and pdf-parse are real. LlamaParse, OCR and embeddings are **mocked** behind the interfaces the real providers will use.
- Code: `lib/documents/actions.ts` (`completeUpload` creates the Document + 5 `DocumentStep` rows), `lib/storage.ts` (`readObject`), `lib/search/vector.ts` (`saveChunkEmbedding`, `EMBEDDING_DIMENSIONS`), the schema (`Document.pagesProcessed/ocrUsed/failureReason`, `Chunk.index` unique per document, `DocumentStep`), `components/documents/*`, `lib/plans.ts`.
- Packages (npm today): `inngest` 4.26.2, `pdf-parse` 2.4.5 (mehmet-kozan, page-aware), `fflate` 0.8.3. During implementation I'll read the Inngest v4 docs (Next.js `serve`, steps, retries, concurrency, `onFailure`, signing) and the pdf-parse v2 README.

## Decisions
- **Inngest** (`npm i inngest`):
  - The client lives in `lib/jobs/client.ts`, with the function served at `app/api/inngest/route.ts`.
  - Event `document/uploaded` `{ documentId, userId }` is sent by `completeUpload` and by the new `retryDocument` action.
  - Locally, the **Inngest dev server** (`npm run inngest`, i.e. `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest`) runs the jobs. In production, `INNGEST_SIGNING_KEY` + `INNGEST_EVENT_KEY` verify both directions.
  - **Concurrency:** 2 jobs per user, 10 total (keeps cost and DB load bounded).
  - **Retries:** 2 per step. When retries run out, `onFailure` marks the document Failed with a student-safe reason.
- **Job steps** (each its own Inngest step, so a failure doesn't redo finished work):
  1. `load`: re-check the document exists and belongs to `userId`, the status is PROCESSING, and the page count is within the plan limit. Set the EXTRACT step to RUNNING.
  2. `extract-pages-<n>`: pages are read in **batches of 20** (one step per batch). Each batch's chunks are saved with `createMany … skipDuplicates` on `(documentId, index)`, so a retried batch can't duplicate anything. `pagesProcessed` is updated after each batch. The number of batches is decided by the page count.
  3. `embed-<n>`: chunks without an embedding get one, **50 chunks per step**, through `saveChunkEmbedding` (scoped by user).
  4. `finish`: EXTRACT and EMBED are marked DONE, and the document is **Ready**. The SUMMARY, FLASHCARDS and QUIZ steps stay PENDING. Next prompt they run before Ready.
- **Extractors** (`lib/extract/`). One interface: `extractPages(bytes, fileType) → { pageCount, pages(from, to) → [{ page, text }] }`.
  - **PDF (real, pdf-parse):** text per page. A page with fewer than 20 characters of text is treated as scanned and goes to **OCR (mock)**, and `ocrUsed` is set.
  - **PPTX (free, local):** unzip with `fflate`, read the slide XML in order (`ppt/slides/slideN.xml`), and use the text runs (`<a:t>`) plus speaker notes. One "page" = one slide.
  - **DOCX (free, local):** unzip with `fflate` and read `word/document.xml`. Word files have no fixed pages, so text splits at explicit page breaks, and otherwise into pages of about 500 words.

    This local reading stands in for **LlamaParse**: same interface, swapped later by `PARSER=llamaparse`.
  - **Photo:** **OCR (mock)**, one page.
- **OCR mock** (`lib/extract/ocr.ts`, interface `ocrPage(bytes, page) → string`): returns clearly marked placeholder text, "[OCR preview] Handwritten notes, page N. Real text recognition is not connected yet.", so the rest of the pipeline and the UI can be tested. Swapped later by `OCR_PROVIDER`.
- **Chunking** (`lib/extract/chunk.ts`, real): text is normalised per page (whitespace, hyphenation at line ends), then split into chunks of about **1,000 characters with 150 overlap**, on sentence boundaries where possible. A chunk never crosses a page, so every chunk keeps its exact page number. Empty pages produce no chunk.
- **Embeddings mock** (`lib/ai/embeddings.ts`, interface `embed(texts) → number[][]`, 1536 dimensions): **deterministic feature hashing**. Words and word pairs are hashed into 1536 slots and L2-normalised. Similar text gives similar vectors, so chat search will return sensibly related chunks even before a real model exists. Swapped later by `EMBEDDING_PROVIDER=openai` (`text-embedding-3-small`, also 1536, so no schema change).
- **Plan page limits** (env, `lib/plans.ts`): `FREE_MAX_PAGES=50`, `PRO_MAX_PAGES=300`. A longer file fails with "This file has 120 pages. The Free plan reads up to 50 pages per file."
- **Failure reasons** are short, student-safe, and never contain document text:
  - Couldn't read the file (damaged or password-protected)
  - No text found
  - Too many pages for your plan
  - Something went wrong (retry)
- **Retry:** the server action `retryDocument(documentId)` checks ownership and that the status is FAILED. It deletes that document's chunks, resets the steps to PENDING, `pagesProcessed` to 0 and the status to PROCESSING, then sends the event again. Retry is **not** optimistic: it shows "Processing" only after the server accepts.
- **Untrusted text:** text is stored as data only. Nothing in this step sends it to an AI. The prompt-injection rules come with the AI prompt.

## UI (existing design system)
- **Document row while Processing:** the `StatusBadge` shows "Processing", plus a small `Progress` bar and the line "Reading page 12 of 40" (from `pagesProcessed` / `pageCount`), "Preparing for search…" during embedding, or "Starting…" before the first batch.
- **Live updates:** while any document on the page is Processing, the client island calls `router.refresh()` every **3 s**. It stops when none are processing and pauses while the tab is hidden. No new API route is needed.
- **Failed:** red reason text plus a **Retry** button (secondary, small, 44px on touch) in the row's actions.
- **Ready:** green "Ready" badge plus "40 pages". If `ocrUsed`: a muted note, "Some pages were read from images. Check the original if something looks off" (§12).
- Responsive as before (320–1920, long names wrap).

## Files
- `npm i inngest pdf-parse fflate`
- New `lib/jobs/client.ts`, `lib/jobs/process-document.ts`, `app/api/inngest/route.ts`
- New `lib/extract/index.ts`, `pdf.ts`, `office.ts` (pptx + docx), `ocr.ts` (mock), `chunk.ts`
- New `lib/ai/embeddings.ts` (mock with a provider switch)
- Edit `lib/documents/actions.ts` (send the event on complete; new `retryDocument`), `lib/documents/queries.ts` + `types.ts` (`pagesProcessed`, `ocrUsed`, step states in `DocumentView`), `components/documents/document-list.tsx`, `subject-documents.tsx` (progress, polling, Retry), `lib/plans.ts` (page limits)
- `package.json` (`inngest` script), `.env.example` (`INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_DEV`, `FREE_MAX_PAGES`, `PRO_MAX_PAGES`, `PARSER`, `OCR_PROVIDER`, `EMBEDDING_PROVIDER`)

## Security
- The job trusts only `documentId` + `userId` from the event, re-reads the document scoped by **both**, and stops if they don't match.
- The `/api/inngest` route is verified by the Inngest signing key in production. In dev it only answers the local dev server.
- File bytes are read server-side from private storage. Nothing about the file goes to logs, Sentry or PostHog (no text, no names).
- Chunks are written with `userId` + `subjectId` copied from the document, never from the event. The embedding update is scoped by user.
- The page limit and file size are enforced on the server, inside the job.

## Acceptance criteria
- With `npm run dev` and `npm run inngest` running:
  - A real **PDF** becomes Ready with chunks on the right pages.
  - A **PPTX** becomes Ready with one page per slide.
  - A **DOCX** becomes Ready.
  - A **photo** becomes Ready with the OCR-preview text on page 1 and the OCR note.
- A scanned PDF (no text layer) uses mock OCR per page and is marked `ocrUsed`.
- Every chunk has a 1536-dimension embedding. `searchChunks` with an embedding of a sentence from page 3 returns a page-3 chunk first.
- A damaged PDF → Failed: "Couldn't read this file…". A 60-page PDF on Free → Failed with the page message. With mock Pro it's accepted.
- Retry on a Failed document re-runs it, and Ready works after fixing the cause (e.g. mock Pro on). There are no duplicate chunks after retries.
- Killing the job mid-way (stop the dev server) and resuming doesn't duplicate chunks or redo finished batches.
- The page shows live progress and switches to Ready without a manual refresh. Polling stops afterwards.
- Another user's documentId in a forged event is ignored.

## Checks
`npx tsc --noEmit`, `npm run lint`, `npm run build`. Unit tests (temporary script) for chunking (page kept, overlap, no cross-page chunks), the embedding mock (deterministic, normalised, similarity), and the PPTX/DOCX/PDF extractors against small generated files. An end-to-end run through the Inngest dev server with real files in the dev bucket. The UI is checked in a browser if browser tools are available; otherwise the steps below are for you.

## Manual test
1. Terminal 1: `npm run dev`. Terminal 2: `npm run inngest`. Then open http://localhost:8288 (the Inngest dashboard).
2. Upload a PDF to a subject: the row shows "Reading page X of Y", then **Ready** with the page count, with no refresh needed. The Inngest dashboard shows the run and its steps.
3. Upload a PowerPoint, a Word file and a phone photo: all become Ready. The photo shows the "read from images" note.
4. Upload a password-protected or damaged PDF: **Failed** with a reason and **Retry**.
5. On Free, upload a PDF longer than 50 pages: Failed with the page-limit message. Run `npm run dev:pro -- <your id> on`, then click Retry: Ready.
6. `npx prisma studio` → `Chunk`: rows have page numbers that match the file.
7. Check the processing row and the Failed row at 320, 768 and 1280 wide.

## Implementation notes (2026-11-06)
- Inngest v4: the trigger goes in the function config. Per-document `singleton` (skip) plus a per-upload event `id` stop duplicate runs. Concurrency is 2 per user and 10 total. Student-facing failures throw a `NonRetriableError` subclass, and `onFailure` shows its message (anything else shows a generic retry message).
- pdf-parse v2: `getInfo().total` gives the page count, and `getText({ first, last })` reads one batch. `serverExternalPackages` covers pdf-parse, pdfjs-dist and @napi-rs/canvas.
- `Chunk.index` = page × 1000 + position. It stays stable across retries, so `createMany skipDuplicates` keeps chunk writes idempotent.
- Embeddings are written in one SQL statement per batch (`unnest`), scoped by user.
- Tests:
  - tsc, lint and build pass.
  - 24/24 unit checks: chunking, the embedding mock, and the PDF/PPTX/DOCX/photo extractors on generated files.
  - 19/19 end-to-end checks through a real Inngest dev server and the dev bucket/DB: all 4 types Ready, scanned page → OCR, search finds the right page, damaged PDF Failed, page limit then Retry with mock Pro → Ready over 3 batches with no duplicates, other-user retry refused, forged and re-sent events ignored.
- Not tested in a browser (no browser tools in this session).
