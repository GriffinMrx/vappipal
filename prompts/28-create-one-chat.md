# 28 · Create: one chat for asking and editing, "Ask Vappi" on selection, slower live typing

## Goal
The creation editor currently has its own "Ask Vappi to change it" composer **and** the side chat: two AI inputs. Keep only the side chat. On a creation page the side chat knows the document: tell it what to change and Vappi edits the document live; ask it something and it answers (about the document and the files). Selecting text shows a small floating **Ask Vappi** button. Vappi types slower and steadier so the pal animation can be enjoyed.

From the user's screenshots, also fix:
- `[overview, 5]` / `[overview, 1, 11]` citation markers left in the document text.
- The sticky toolbar lets text show through it.
- The chat replied "I can't directly edit the PDF" to "no on the file edit it" (it didn't know about the document).

## Docs / code read
- `components/create/creation-editor.tsx`: generation, `runEdit`, the composer at the bottom, Keep/Undo bar.
- `components/chat/space-chat.tsx`, `chat-panel.tsx`, `chat-composer.tsx`, `space-chat-slot.tsx`.
- `app/api/spaces/[spaceId]/chat/route.ts` (Pro only), `lib/chat/answer.ts`, `lib/chat/intent.ts`, `lib/ai/prompts.ts` (`CHAT_SYSTEM`, `chatInput`).
- `app/api/spaces/[spaceId]/creations/[creationId]/edit/route.ts` (any plan, 60/hour).
- `lib/creations/markdown-text.ts` (`CITE` regex misses mixed `[overview, 5]`).

## Decisions
1. **Editor bridge.** A plain module `components/create/editor-bridge.ts` (tiny external store like `palStore`, no "use client" exports issue). The editor registers: creation title, current selection preview, busy flag, `edit(instruction, auto)` and `markdown()`, `clearSelection()`. The side chat reads it with `useSyncExternalStore`; when it's present the chat is "on the document".
2. **Remove the editor's composer.** The toolbar's **Ask Vappi** button and the new floating selection button open the side chat and focus its input.
3. **Routing (edit vs ask)** in the edit route with `auto: true`:
   - Quick rules first: starts with an edit verb (make, rewrite, change, edit, add, remove, delete, shorten, expand, fix, turn, simplify, continue, translate, format, bold…) → edit; a question word + "?" → ask.
   - Otherwise the fast model decides (`lib/creations/intent.ts`, JSON, 8 s timeout). On any error → edit (reversible with Undo).
   - "ask" → the route answers `{t:"ask"}` and stops; nothing is counted. The chat then calls the chat route with the document attached.
   - Free users (side chat is Pro): on a creation page they get the same side chat in **edit-only** mode (every message edits, no Ask), so they don't lose the AI editing they have today.
4. **Chat knows the document.** The chat route accepts an optional `document: { title, markdown }` (≤ 30 000 chars, the user's own text, treated as DATA inside `<document>` tags). `CHAT_SYSTEM` gains one rule: "this / it" means that document; never claim you can't edit it — say they can tell you what to change.
5. **Edit turns in the chat** show as a user bubble + a Vappi row ("Editing your selection…" with the writing pal → "Done. Keep it or undo it in the document." / the error). They are not saved to the database (they vanish on refresh and are excluded from Regenerate). On narrow screens (chat full screen) the chat closes when an edit starts so the user watches it live.
6. **Floating "Ask Vappi" on selection:** a small pill above the selection while it's non-empty and Vappi is idle (custom positioned, no new package). The chip in the chat composer reads "Your selection · <title>" (× clears it) or "<title>". While focus is in the chat the picked text stays tinted in the document.
7. **Slower typing:** a pacer (`components/create/typewriter.ts`) reveals text at ~45 characters/second, speeding up only when far behind (backlog drained within ~8 s), for both new creations and edits. The pal caret moves with it. Stop keeps what was revealed and saves it.
8. **Citations:** the `CITE` regex accepts any mix of numbers / `overview` / `source` in one bracket; `citedIds` too. Existing saved documents are cleaned when read (`getCreation` strips markers from text nodes).
9. **Toolbar:** opaque background.

## Files
- New: `components/create/editor-bridge.ts`, `components/create/typewriter.ts`, `lib/creations/intent.ts`.
- Edit: `creation-editor.tsx`, `editor-toolbar.tsx` (button only), `space-chat.tsx`, `space-chat-slot.tsx`, create page, `chat/route.ts`, `lib/chat/answer.ts`, `lib/ai/prompts.ts`, edit route, `markdown-text.ts`, `lib/creations/queries.ts`, `lib/chat/types.ts`, `globals.css` (selection tint).

## Security
- Edit route keeps owner check, 60/hour cap; the classifier runs only after the owner check and rate check, using the fast model with escaped input.
- The document sent to the chat is the user's own text, escaped and fenced as DATA; chat route stays Pro + owner + rate limited.
- No document text in logs.

## Acceptance
- Only one AI input on a creation page (the side chat).
- "make it shorter" in the side chat → document edits live with the pal, Keep / Undo works.
- "what is this story about?" → answered in chat, document untouched.
- Selecting text shows **Ask Vappi**; clicking it opens the chat with "Your selection" and the edit touches only those blocks.
- New creation and edits type visibly slower and steadily.
- No `[overview, 5]` markers in new or existing documents.
- Free user on a creation page: side chat edits the document.
- No horizontal scroll 320–1920; signed out / other user refused.

## Checks
tsc, lint, build; headless Chrome with real Gemini at 1280 and 375: edit via chat, ask via chat, selection button, typing speed (time to reveal), Undo, citations gone, free edit-only mode, security (401/404).

## Manual test
1. Open a creation, open Chat: the chip shows the creation's title.
2. Type "make it shorter" → watch the document change; click Undo, then try again and Keep.
3. Type "what is this about?" → answer appears in chat, document unchanged.
4. Select a paragraph → click the floating **Ask Vappi** → type "more formal" → only that part changes.
5. Create a new Blog post → it types slower with the pal following.

## Implementation notes
- Pace: 45 chars/s base, catching up within ~25 s when far behind; finishing a word is charged to the pace (otherwise it ran ~3× faster). Measured ~40 visible chars/s; a Notes doc takes ~25 s instead of ~10 s.
- A selection inside a list edits the whole list (edits replace whole top-level blocks, as before).
- The floating button also appears when focus arrives after the selection (keyboard / programmatic).
- Old documents: markers are stripped when read; the stored copy is cleaned on the next save.
- Edit route: the rate check runs before the classifier; nothing is counted for questions.
