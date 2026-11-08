# 20 — Chat: nicer answers, Copy, Regenerate

The user asked:
- AI answers should look better.
- They want to **copy** messages.
- They want to **regenerate** when an error happens.

There's no reference image, so this follows the existing design system (AGENTS.md §3).

## Code read
- `components/chat/course-chat.tsx`. Answers are one `whitespace-pre-wrap` block, and `tidy()` *strips* markdown, so `**bold**` is lost and lists are plain "•" lines. Sources are text links under the answer.
- Failure handling: any error (even after the server has saved the question) rolls the bubble back and puts the text back in the box. There's no "try again" in the conversation.
- `lib/chat/answer.ts`: the question is upserted on `(userId, clientId)`.
- `app/api/subjects/[subjectId]/chat/route.ts`, `lib/chat/types.ts`, `lib/chat/queries.ts`.

## Decisions

### Answer look
- **Assistant row:** a small round accent avatar (lucide `Sparkles` on the accent gradient) and the name "Vappi" in muted text. The text sits beside it at `text-[0.9375rem] leading-7 text-fg-body`. On phones the avatar sits above the text, so nothing gets squeezed.
- **Light formatting, rendered safely** (no HTML injection; React elements only) by a small renderer, `lib/chat/format.ts` + `components/chat/answer-text.tsx`:
  - blank lines → paragraphs with spacing;
  - lines starting `- `, `* ` or `• ` → a real bulleted list; `1. ` → a numbered list;
  - `**bold**` → `<strong class="text-fg">`;
  - `[n]` → the existing citation pill.
  - Headings and tables are flattened to text, since the prompt asks for plain text.
  - While streaming, words still fade in.
- **Sources:** the cited pages become small cards in a wrap row. Each shows a page badge ("p. 3"), the file name truncated to one line, and an open icon. They're 44px tall on touch screens and open the page.
- **User bubble:** unchanged shape, slightly roomier.

### Actions (under each message, `text-fg-subtle`, 44px targets on touch, compact from `lg`)
- **Copy** on every message (user and assistant).
  - Assistant text is copied **clean**, with `[n]` turned into "(p. 3)".
  - It uses `navigator.clipboard`, falling back to a hidden textarea + `execCommand` on non-secure LAN addresses.
  - The icon becomes a check with "Copied" for 1.5 s. Screen readers get a status.
- **Regenerate** on the **latest** answer only: it re-asks the same question and replaces that answer.
- **On error after the question was saved:** the question stays in the chat, and an inline error card shows the error ("Couldn't answer. Try again.") with a **Try again** button that runs Regenerate. No toast and no rollback, since the message *was* sent.
- **Errors before the server accepts the message** (offline, 401/403/429) keep the current optimistic rollback: the bubble disappears, the text goes back in the box, and a toast shows (AGENTS.md §7).

### Server: regenerate
- The route body gets an optional `regenerate: true`. It must come with the `clientId` of the question being regenerated.
- The server re-checks that this question is the user's **latest** question in the subject, and returns 409 otherwise. It then deletes the assistant answer(s) after it, answers again, and saves the new answer. The question row is reused (same `clientId` upsert), so it's never duplicated.
- Chat history views gain `clientId` on user messages, so loaded conversations can be regenerated after a refresh.
- The rate limit stays per user message. A regenerate doesn't create a new user message, so it's capped separately at **10 regenerates per hour**. That needs no migration: the server counts the assistant answers created in the last hour, and refuses when there are more than (user messages that hour + 10). It returns the existing 429.

## Files
- **New:** `lib/chat/format.ts` (pure parse → blocks; unit-tested), `components/chat/answer-text.tsx`, `components/chat/message-actions.tsx`.
- **Edit:** `components/chat/course-chat.tsx`, `lib/chat/types.ts` (`clientId` on views), `lib/chat/queries.ts`, `lib/chat/answer.ts` (regenerate), `app/api/subjects/[subjectId]/chat/route.ts`.

## Security
- Same checks (signed in → owner → Pro → Zod → rate limit). Regenerate only touches the caller's own latest exchange in that subject.
- The formatter outputs React elements only; model text is never set as HTML.

## Acceptance criteria
- Answers show paragraphs, real lists and bold. Citation pills stay inline, and page cards sit underneath. It looks right at 320–1920.
- Copy works for user and assistant messages (clean text, with a "Copied" check), including on the LAN address.
- Regenerate on the latest answer replaces it, and the question isn't duplicated (also after a refresh). A stream error shows an inline Try again that works. Offline sending still rolls back.
- Regenerating an older question → 409.

## Checks
- `tsc`, lint, build.
- Unit test of `format.ts`: paragraphs, lists, bold, citations, and that HTML-looking text stays text.
- A route test with a session token: regenerate replaces the answer (row counts), and a 409 on an old question.
- Headless Chrome screenshots of the panel and the expanded view, with a formatted answer.

## Manual test
1. Ask "List the main characters" → a bulleted list with page pills and page cards.
2. Click **Copy** on the answer and paste it somewhere → clean text with "(p. N)".
3. Click **Regenerate** → a new answer replaces the old one. Refresh → only one answer is there.
4. Stop the dev server mid-answer → an inline "Couldn't answer" card → start the server → **Try again** works.

## Implementation notes (after building)
- **Aceternity "Direction Aware Selection"** (the user suggested it, if it fits): it's an Aceternity **Pro** component, so the code needs an All-Access license. It's also a decorative hover effect for an intro paragraph (a resize frame sliding between names and logos), which doesn't fit a chat answer. Not used.
- **The avatar's position follows the chat's own width** (Tailwind container queries, `@xl:`): it sits above the text in the narrow side panel and on phones, and beside it in the full-screen view.
- **Citation pills and the punctuation right after them stay on one line,** so there's no lone "." on its own line.
- **Copy:** `plainAnswer` merges a run of pills like `[1][2]` into one "(p. 3, 5)".
- **Errors:** an error after the server accepted the question (stream error, or the connection dropping mid-answer) shows an inline "Couldn't answer" card with **Try again**, which re-runs the question using the same id. Errors before the server accepts the message keep the optimistic rollback.
- **Tests:**
  - Unit test of `format.ts`: paragraphs, lists, bold, citations, HTML staying text, and clean copy.
  - Route: Regenerate replaced the answer (4 rows before → 4 after); an older question gave 409, and an unknown id gave 404.
  - Headless Chrome screenshots (desktop panel, expanded, phone): the input is visible at every size, with no sideways scroll.
- **Pro access during testing:** the user's mock Exam Pass is marked `CANCELLED` (changed 2026-11-06 22:34, not by me). It was left alone; the tests used a temporary Pro row that was removed afterwards, along with all test messages.
