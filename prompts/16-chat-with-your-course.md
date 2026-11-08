# 16 — Feature 5: Chat with your course

Students ask questions about one subject. The answer **streams**, uses **only their own notes**, and cites the **pages** it used as links. When the notes don't cover the question, it says so instead of guessing. It's a new **Chat** tab on the subject page. Billing stays mocked; chat is a Pro feature (`npm run dev:pro`).

## Docs and code read
- AGENTS.md:
  - §1 / §7: chat is Pro. Grounded only. Every answer cites pages, and says so when the notes don't have the answer. Chat uses the better model (`AI_MODEL_SMART`). Sending a chat message is **optimistic**; the answer itself is **not** (it streams).
  - §9.7: find the closest chunks for the subject, send **only those**, and stream an answer citing pages.
  - §11: answers stream, cite pages as links, and say clearly when the notes lack the answer.
  - §12:
    - The vector query is filtered by user + subject, with `$queryRaw` only.
    - Document text **and the student's message** are untrusted.
    - Never send chat text to logs, Sentry or PostHog.
- Next docs `02-guides/streaming.md` ("Streaming in Route Handlers"): a `ReadableStream` in a `Response`, plus `X-Content-Type-Options: nosniff`.
- Gemini skill (Streaming): `interactions.create({... stream: true})`; events `step.delta` with `delta.type === "text"`, ending with `interaction.completed`.
- Code:
  - `lib/search/vector.ts` `searchChunks({userId, subjectId, embedding, limit, model})`.
  - `lib/ai/embeddings.ts` (`embedQuery`, `currentEmbeddingModel`).
  - `lib/ai/gemini.ts` (MODELS, `mapError`, timeouts).
  - `lib/ai/prompts.ts` (`DATA_RULES`, `escapeTags`).
  - `lib/billing/access.ts` (`hasProAccess`).
  - `components/study/source-link.tsx`, `components/subjects/subject-tabs.tsx`, `quiz-runner.tsx` (the limit / upgrade card pattern), `components/ui/toast.tsx`.
  - Schema `ChatMessage` (role, content, citations Json, `clientId` unique per user): **no migration needed**.

## Decisions
- **Where:** a new tab, `/subjects/[id]?tab=chat` ("Chat"), after Quiz.
- **Who:**
  - Pro only, checked on the server in the page and in the route.
  - Free users see the existing upgrade-card pattern: "Chat with your notes is a Pro feature" + **Upgrade** (to `/billing`).
- **Route:** `POST /api/subjects/[subjectId]/chat`, a route handler, because the answer streams.
  - Body (Zod): `{ clientId: string (≤64), message: string (1–2000 chars, trimmed) }`.
  - Checks, in order:
    1. Signed in, else 401.
    2. The subject is the user's, else 404.
    3. Pro, else 403 with `{error:"pro"}`.
    4. Rate limit, else 429.
- **Rate limit:** at most `CHAT_MAX_PER_HOUR` user messages per hour (env, default 60), counted from `ChatMessage`. It protects cost; the number lives in `lib/plans.ts`.
- **Saving:**
  - The user's message is saved first, upserted on `(userId, clientId)`, so a retry never duplicates it.
  - The assistant message is saved when the stream finishes, with its citations `[{documentId, page}]`.
  - If generation fails, nothing is saved for the assistant, and the user message stays.
- **Retrieval:**
  - Embed the question. If it's a short follow-up (< 6 words), also embed it together with the previous user question.
  - Run `searchChunks` with the current embedding model, top 8.
  - Drop matches whose cosine distance is worse than `CHAT_MAX_DISTANCE` (env, default 0.6 for Gemini; mock vectors use 0.95).
- **No relevant chunks:** reply right away with the fixed text "I couldn't find this in your notes for this subject. Try rephrasing, or upload the material that covers it." No AI call, and no citations.
- **Prompt (`CHAT_SYSTEM` in `prompts.ts`):**
  - Excerpts are sent as `<excerpt id="1" page="12" doc="Cell biology.pdf">…</excerpt>` inside `<course_material>`. The question goes in `<student_question>`. Both are escaped, and both are treated as data.
  - Answer only from the excerpts.
  - Cite with `[1]`, `[2]` right after the sentence that uses them.
  - If the excerpts don't contain the answer, reply exactly `NOT_IN_NOTES`, which the server turns into the fixed text above.
  - Short paragraphs or lists, in the language of the question.
  - The last 6 messages are given as `<history>` (data) for follow-ups. History is never used as a source of facts.
- **Stream format:** NDJSON (`application/x-ndjson`), one JSON object per line:
  - `{"t":"delta","text":"…"}` (many).
  - Then `{"t":"done","id":"…","citations":[{n,documentId,title,fileType,page}]}` or `{"t":"error","message":"…"}`.
  - Only citation numbers the model actually used, and that exist in the excerpts, are kept. Made-up numbers are removed from the text.
  - `NOT_IN_NOTES` handling: the server holds back the first ~14 characters before sending deltas, so the token is never shown.
- **Model:** `MODELS.smart`, `stream: true`, `store: false`, `thinking_level: "low"`, `maxDuration = 60` on the route, and a 45 s timeout. 429/503 → `{"t":"error","message":"The AI is busy, try again in a moment."}`.
- **Mock provider** (no key): an extractive answer from the top 2 excerpts ("From your notes: … [1]"), streamed word by word, so the UI and tests work offline.
- **UI (`components/chat/course-chat.tsx`, client):**
  - The message list shows the user's bubbles on the right and the assistant's on the left, with full width on mobile.
  - `[n]` in the text becomes a small link to that source page. Under each answer, the cited pages appear as `SourceLink` chips (no duplicates).
  - A composer is pinned at the bottom of the tab: an auto-growing textarea (Enter sends, Shift+Enter makes a new line) and a 44px Send button. It's disabled while an answer streams, and a **Stop** button aborts.
  - **Optimistic send:** the user bubble appears at once (`useOptimistic` inside a transition) and the box clears.
    - On failure (network, 4xx/5xx, error line), the bubble is removed, the typed text is put back in the box, and an error toast shows.
    - On success, the page refreshes (`router.refresh()`) so the saved messages become the source of truth.
  - The answer shows a "Searching your notes…" loading state, then the streaming text.
  - Empty state: "Ask anything about {subject}. Answers come only from your notes, with page links." plus 3 example chips. The chips are generic, never invented content.
  - It loads the last 50 messages server-side, oldest first. A "Clear chat" ⋯ action is **not** built; that's out of scope.
- No new packages.

## Files
- `app/api/subjects/[subjectId]/chat/route.ts` (new)
- `lib/chat/answer.ts` (new, server-only): retrieval, the prompt, the stream, citations, and saving.
- `lib/chat/queries.ts` (new): `listChatMessages`.
- `lib/ai/gemini.ts`: `streamText()`.
- `lib/ai/prompts.ts`: `CHAT_SYSTEM`, `chatInput()`; the escaped tags gain `excerpt|student_question|history`.
- `lib/plans.ts`: `CHAT_MAX_PER_HOUR`, `CHAT_MAX_DISTANCE`.
- `components/chat/course-chat.tsx` (new).
- `components/subjects/subject-tabs.tsx` and `app/(app)/subjects/[subjectId]/page.tsx`: the Chat tab.
- `.env.example`: the new variables.

## Security
- Each check has its own error: signed in (401), owner of the subject (404), Pro (403), Zod (400), rate limit (429). All run before any AI or embedding call.
- Vector search is always scoped by user + subject (existing `searchChunks`).
- The question, excerpts and history are wrapped as data and tag-escaped, so an injected "ignore previous instructions" can't change the task or the format.
- Citations are mapped server-side from excerpt ids to that user's documents; the model never chooses document ids.
- Errors are logged with the status only, never message or course text.

## Acceptance criteria
- A Pro user asks a question → the answer streams in, with `[n]` links and source chips that open the right page.
- The question and the answer are still there after a refresh, with no duplicates.
- Asking something the notes don't cover → the fixed "couldn't find this in your notes" reply, with no citations.
- A free user sees the upgrade card in the tab, and the route returns 403.
- Signed out → 401. Another user's subject → 404. Empty or oversized message → 400.
- When the send fails, the bubble rolls back, the typed text is back in the box, and an error toast shows.
- A prompt injection inside a document or a question doesn't change the behaviour.
- The layout works at 320–1920 with no horizontal scroll, and long words and file names wrap.

## Checks
- `tsc --noEmit`, `npm run lint`, `npm run build`.
- A script against the dev branch:
  - Calls `answer` with Gemini on the sample document and the book. It checks the citations point to pages containing the answer, the not-in-notes path, an injection question, and the mock path.
  - Hits the real route on `next start` signed out (401) and with a bad body.

## Manual test
1. `npm run dev:pro` (if your user isn't Pro), then `npm run dev`.
2. Open a Ready subject → **Chat** tab.
3. Ask "What is rule number one?" (the book) → the answer streams, and a `[1]` link opens the cited page.
4. Ask "What is the capital of France?" → "I couldn't find this in your notes…".
5. Refresh → both questions and answers are still there.
6. Go offline (DevTools → Network → Offline) and send → the bubble disappears, your text is back, and an error toast shows.
7. Check 320px and 1440px widths.

## Implementation notes (after building)
- **UI, inspired by the Wensity pages the user linked.** They are paid "Pro" components with no free code, so these are original builds based only on the public descriptions:
  - `components/chat/ai-typing-indicator.tsx`: a shimmering label with rotating phrases, an icon, elapsed seconds, and bouncing dots. Screen readers hear it once, and reduced motion keeps it still.
  - The agent-style step trace is "Searching → Found N passages · M pages → Writing". It folds into "Worked for Ns" once done.
  - Words fade in while the answer streams (`animate-word-in`), and Stop keeps the partial answer.
- **Not built, because it doesn't fit grounded-only chat:** web search, the model picker, attachments, dictation, retry versions and thumbs feedback.
- **Distance cutoff:** measured with gemini-embedding-2, related questions scored 0.26–0.40 and unrelated ones 0.41–0.53. The default is now **0.5**, not 0.6. The model's `NOT_IN_NOTES` reply catches the rest (France, and the "poem about cats" injection, both returned the fixed reply).
- **Gemini streaming:** `interactions.create({stream:true})`, keeping only `step.delta` events with `delta.type==="text"`. A passed `signal` overrides `timeout_ms`, so the code combines `AbortSignal.timeout(45s)` with the Stop signal.
- **Retrying a failed send** with the same text reuses its `clientId`, so the server never stores the question twice.
- **Signed-in route tests** used a short-lived Clerk session token (created, then revoked): 400 for bad input, 404 for another user's subject, 403 for a free user, and a 200 NDJSON stream with the first text after ~2.6 s. Repeating the same `clientId` leaves one row, and a stopped answer is saved.
- All test chat rows were deleted afterwards.
