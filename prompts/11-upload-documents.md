# 11 — Feature 1: Upload course files into a subject

First of the feature series (one prompt per feature, AI mocked, billing last). This step: a student uploads files into a subject. The server checks the user, the plan limit, the file type and the size, and the file goes into **private Neon Object Storage**. A document row appears with the status **Processing**. The student can open their file through a short-lived link and delete it. Reading the file (text, OCR, chunks) is the **next** prompt, so documents stay "Processing" after this step.

## Docs and code read
- AGENTS.md §3, §5, §7 (optimistic delete; uploads are NOT optimistic, they show real progress), §8, §9 step 1–2, §11 (limit reached → show the limit + upgrade), §12 (private files, short-lived signed URLs), §13.
- Neon Object Storage skill + docs (`storage/s3-compatibility`): S3 API, `forcePathStyle: true`, SigV4, presigned GET/PUT, **browser form uploads (POST) supported**, `PutBucketCors` supported, `DeleteObject` is a soft delete on the branch. Buckets are declared in `neon.ts` → `neon deploy` provisions them on the linked branch and writes `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION` into `.env.local`. The project is in `aws-eu-central-1` (supported).
- Code: `app/(app)/subjects/[subjectId]/page.tsx` (placeholder "Coming next"), `lib/subjects/queries.ts` (`getSubject` scoped by user), `components/subjects/*` (optimistic pattern with `useOptimistic` + toast rollback), `components/ui/*` (Button, Card, Badge/`StatusBadge`, Progress, EmptyState, Dialog, Sheet, toast), `components/icons` (file-pdf, file-word, file-image, document, rectagular-upload icons exist), `lib/limits.ts` (`checkLimit(userId, "document")`), `lib/plans.ts`, `next.config.ts` (`cacheComponents`).
- I'll read `node_modules/next/dist/docs/` for server actions and route handlers before coding.

## Decisions
- **Storage: Neon Object Storage** (user's choice). One **private** bucket `course-files`, declared in `neon.ts`, provisioned on the **dev** branch only (`neon deploy` while linked to dev). Production gets it at deploy time.
- **Direct browser upload with a presigned POST.** Vercel functions reject request bodies over 4.5 MB, so the file never passes through our server. The server signs a POST policy that pins:
  - the **exact key** `users/<userId>/<subjectId>/<uuid>`
  - the exact `Content-Type`
  - `content-length-range` 1 byte … the plan's max size
  - a 5-minute expiry

  The browser can't upload anything else with it.
- **Flow (3 calls):**
  1. Server action `prepareUpload({ subjectId, fileName, size, mimeType })`:
     - checks the user owns the subject
     - checks the type is allowed and the size is within the plan's maximum
     - runs `checkLimit(user, "document")`
     - returns `{ url, fields, key }`, or `{ limitReached: { limit, used } }`, or a field error.
  2. The browser POSTs the file to the bucket with XHR for real upload progress.
  3. Server action `completeUpload({ subjectId, key, fileName })`:
     - re-checks the user, the subject, and that the key starts with `users/<userId>/<subjectId>/` (so no one can claim another user's object)
     - re-checks the limit
     - `HeadObject` for the real size and type
     - reads the first bytes (`Range: bytes=0-15`) and checks the file signature (PDF `%PDF`, DOCX/PPTX `PK` zip, JPEG `FFD8FF`, PNG `89504E47`, WEBP `RIFF…WEBP`), so a renamed `.exe` is refused
     - creates the `Document` (status `PROCESSING`, `fileKey`, `fileType`, `mimeType`, `sizeBytes`, `title` = cleaned file name) plus its five `DocumentStep` rows as `PENDING`.

     If a check fails, the object is deleted and the student sees why.
- **Allowed types:** PDF, PowerPoint (`.pptx`), Word (`.docx`), and photos (JPEG, PNG, WEBP). Old `.ppt`/`.doc` and HEIC are refused with a clear message ("Save it as .pptx" / "Export the photo as JPEG"). Checked by extension **and** MIME type on prepare, and by file signature on complete.
- **Size limits from env:** `FREE_MAX_FILE_MB=20`, `PRO_MAX_FILE_MB=50` (in `lib/plans.ts`). Page limits per plan come with the processing step.
- **Plan check is mocked** (billing comes last): Pro = `hasProAccess`, which you can turn on for testing with a dev-only script `npm run dev:pro -- <userId> on|off` that inserts or removes a test-mode Exam Pass row on the dev branch. It refuses to run on production.
- **Limit reached:** the upload area shows "Free plan: 3 of 3 documents used" plus an **Upgrade** button (links to `/billing`, which is a mock for now), instead of a failed upload (§11).
- **Open file:** `GET /subjects/[subjectId]/documents/[documentId]/file` route handler:
  - checks the user owns the document, else 404
  - redirects to a **5-minute presigned GET** with `response-content-disposition: inline; filename=…`
  - with `Cache-Control: no-store`.

  It never returns a public link. A `#page=N` suffix works for PDFs, so source-page links later can reuse this route.
- **Delete document: optimistic** (§7). The row disappears at once with `useOptimistic`. The server action re-checks ownership, deletes the row (which cascades chunks, cards, questions and steps), then deletes the object. On failure the row comes back with an error toast. A confirm dialog comes first ("Delete 'file.pdf'? Its flashcards and quiz questions are deleted too.").
- **Multiple files:** pick or drop several at once. They upload one after another, each with its own progress row. A failed file doesn't stop the others.
- **CORS:** a setup script `npm run storage:cors` sets the bucket's CORS rule. It allows POST and GET from `http://localhost:3000`, `*.trycloudflare.com` and the `APP_URL` env value. Run once per branch.
- **Orphans:** if a browser uploads but never calls `completeUpload` (tab closed), the object stays in the bucket without a row. Acceptable for the MVP and noted for a later cleanup job. Keys are random and private, so nothing leaks.

## UI (no reference image, so built from the existing design system)
Subject page (`/subjects/[subjectId]`) replaces the "Coming next" placeholder:
- **PageHeader:** eyebrow "Subject", the title, meta "N documents · Exam 12 Dec", and an **Upload** button (secondary grey, `rectagular-upload` icon) on the right. Below `sm` it stacks under the title, full width.
- **Upload drop zone** (new `components/documents/upload-dropzone.tsx`): dashed `rounded-card border-border` like `EmptyState`, with the upload icon, "Drop files here or **browse**", and "PDF, PowerPoint, Word or photos · up to 20 MB". Hover and drag-over state: `border-border-strong bg-surface/50`. A hidden `<input type=file multiple accept=…>`, keyboard reachable, with a 44px tap target. When the subject has documents the zone is compact (one row); when it has none it's the large empty state.
- **Upload queue:** while files upload, one `Card` row per file shows the file icon, name (wraps or truncates with a tooltip), size, a `Progress` bar with %, and a cancel (×) button. Errors show red text in that row with a dismiss button.
- **Documents list** (new `components/documents/document-list.tsx`): `Card` rows showing:
  - the file-type icon (pdf / word / image; `document` for PowerPoint)
  - the title (breaks anywhere for long names)
  - meta "PDF · 2.4 MB · 12 Nov"
  - a `StatusBadge` (Processing / Ready / Failed with its reason)
  - actions **Open** (ghost button → file route, new tab) and **Delete** (icon button, `Trash2` from lucide)

  On mobile the actions sit under the meta, 44px each.
- **Limit card:** a `Card` with "You've used 3 of 3 free documents", one muted line, and an **Upgrade** (accent) button.
- New components use only existing tokens, Card/Button/Badge/Progress/IconButton/Dialog, and lucide icons (no duotone placeholders).
- Responsive at 320–1920: no horizontal scroll, long file names wrap, buttons ≥44px below `lg`.

## Files
- `neon.ts` (bucket), `.env.local` (written by `neon deploy`; I don't print it), `.env.example` (`AWS_*` names, `STORAGE_BUCKET=course-files`, `FREE_MAX_FILE_MB`, `PRO_MAX_FILE_MB`, `APP_URL`)
- `npm i @aws-sdk/client-s3 @aws-sdk/s3-presigned-post @aws-sdk/s3-request-presigner`
- New `lib/storage.ts` (server-only S3 client with `forcePathStyle`, `presignUpload`, `headObject`, `readHead`, `presignGet`, `deleteObject`)
- New `lib/documents/types.ts` (allowed types, signature table), `lib/documents/actions.ts` (`prepareUpload`, `completeUpload`, `deleteDocument`), `lib/documents/queries.ts` (`listDocuments(userId, subjectId)`)
- New `app/(app)/subjects/[subjectId]/documents/[documentId]/file/route.ts`
- New `components/documents/upload-dropzone.tsx`, `upload-queue.tsx`, `document-list.tsx`, `subject-documents.tsx` (client island: queue + optimistic list)
- Edit `app/(app)/subjects/[subjectId]/page.tsx`, `lib/plans.ts` (file size limits)
- New `scripts/storage-cors.mjs` (`npm run storage:cors`), `scripts/dev-pro.mjs` (`npm run dev:pro`)

## Security
- Storage keys and the `AWS_*` secret are server-only. The browser only ever gets a 5-minute POST policy for one exact key, or a 5-minute GET for its own file.
- Every action and the file route re-check the Clerk user and ownership. Other users' documents return 404, not 403, so nothing reveals that they exist.
- The type is checked three times (extension, MIME, file signature), the size is enforced by the signed policy and re-checked with `HeadObject`, and the limit is enforced on the server on both prepare and complete.
- File names are only stored as the title. They're never logged and never sent to analytics. Keys never contain the file name.
- `dev:pro` and `storage:cors` refuse to run when `NEON_BRANCH` is production.

## Acceptance criteria
- PDF, PPTX, DOCX, JPG, PNG and WEBP files upload with a real progress bar and appear in the list as **Processing**. After a refresh they're still there, and Home's "Documents" count and recent list include them.
- A `.exe` renamed to `.pdf` is refused (with a message), and its object is deleted.
- `.doc`, `.ppt`, HEIC and `.zip` are refused before upload, with a message.
- A 25 MB file on Free is refused before upload (with a message) and is accepted with mock Pro.
- The 4th document on Free shows the limit card instead of uploading. With mock Pro there's no limit.
- **Open** shows the file in a new tab through a signed URL that stops working after 5 minutes. Another user (or signed out) gets 404 / sign-in.
- **Delete** removes the row at once and stays gone after a refresh. When the server fails (offline) the row comes back with an error toast. The object is deleted from the bucket.
- Every new screen works at 320, 375, 414, 768, 1024, 1280, 1440 and 1920, and in landscape.

## Checks
`npx tsc --noEmit`, `npm run lint`, `npm run build`, `neon config status` (bucket on dev). Integration tests with a temporary script against the dev branch and bucket:
- the presigned POST rejects a wrong key, a wrong type and an oversized body
- the signature check
- ownership on complete, delete and the file route
- the limit on prepare and complete
- delete removes the object

The UI is tested in a browser if browser tools are available; otherwise you test it with the steps below.

## Manual test
1. `npm run storage:cors` (once), then `npm run dev`, sign in, and open a subject.
2. Drop a PDF, a PPTX, a DOCX and a phone photo together: four progress bars, then four rows marked "Processing".
3. Refresh: they're still there. Home shows the new count and recent documents.
4. Click **Open** on the PDF: it opens in a new tab. Copy the URL, wait 6 minutes, and reload it: access is denied.
5. Try a `.doc` and a 25 MB file: clear messages, nothing uploaded.
6. On Free with 3 documents, try a 4th: the limit card with Upgrade shows. Run `npm run dev:pro -- <your user id> on` and upload again: it works. Then run `… off`.
7. Delete a document: it's gone at once. Go offline in DevTools and delete another: it comes back with an error toast.
8. Check steps 2, 6 and 7 at 320, 768, 1280 and 1920 wide, and on a landscape phone.

## Implementation notes (2026-11-06)
- `neon deploy` on dev added bucket `course-files` and pulled `AWS_*` into `.env.local`. `npm run storage:cors` set CORS (localhost:3000, `*.trycloudflare.com`, `APP_URL`).
- The header **Upload** button opens the dropzone's file input by id. When the limit card is showing instead, it scrolls to the card.
- The subject date is formatted in the server page itself, because helpers exported from a `"use client"` module can't be called on the server.
- Tests: tsc, lint and build pass. 29/29 integration checks run against the real dev bucket and DB (server actions called with a stubbed Clerk user; temp files deleted). The file route returns 404 + `no-store` when signed out. The `dev:pro` on/off/guards work.
- Not tested in a browser: the browser tools weren't available in this session.
