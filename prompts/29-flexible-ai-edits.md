# 29 · Flexible AI edits: change exactly what the user asks, and anything on the page

## Goal
Today every AI edit replaces whole blocks: highlight three words and the whole paragraph (or the whole list) is tinted and rewritten; ask without a selection ("rename the second heading", "fix the typo in the intro") and the **whole document** is rewritten. Make Vappi edit precisely what the user asks, and let it change anything on the creation's page:
- any words, sentences, headings, list items, sections, or the whole text;
- formatting through Markdown (bold, lists, headings, checklists, quotes);
- adding or removing parts anywhere;
- the page title, the emoji icon and the banner.

## What I read
- `components/create/creation-editor.tsx` (`blockRange`, `runEdit`, the typewriter, the Keep/Undo bar), `components/create/ai-range.ts` (node decorations = whole-block tint).
- The edit route, `EDIT_SYSTEM` / `editInput`, `generateJson` (Gemini JSON output), `creationContext`.

## Decisions
1. **Vappi returns an edit plan, not a rewritten document.** The edit route asks the smart model for JSON (validated with Zod; retried once if invalid) with a short `reply` for the chat and a list of operations:
   - `replace_text {find, replace}`: exact words → new words (inline Markdown allowed, `""` deletes them). Used for small, precise changes anywhere.
   - `replace_selection {markdown}`: the highlighted text only (when there is a selection).
   - `replace_blocks {from, to, markdown}`: rewrite or delete (`""`) whole numbered blocks or sections.
   - `insert {after, markdown}`: new blocks after block N (0 = top).
   - `insert_after_text {anchor, markdown}`: a new list item or paragraph right after a specific line.
   - `set_title {title}`, `set_icon {emoji}`, `set_banner {banner | null}` (one of the 6 banners).
   The prompt tells it to use the smallest operations that do what was asked, to leave everything else exactly as it is, and to rewrite everything only when asked ("make it shorter", "rewrite it for kids").
2. **What it sees:** the title, icon, banner, the document as numbered blocks (`<block n="3">…`), the selection (exact text and its block number), the instruction, plus the file excerpts as today (new facts only from the files; citations become "Made from" pages and are stripped from the text).
3. **Applied live and precisely in the browser:**
   - Each operation is located in the document: exact text first, then case-insensitive, then without Markdown symbols. Overlapping or not-found operations are skipped, and the chat says so.
   - Operations play one after another in document order. Each one types in at the calm pace, with the pal caret and a tint on **only the text being changed** (inline tint, not the whole block).
   - Plain-text replacements keep the existing formatting (bold stays bold).
4. **Selection tint:** the picked text is tinted exactly (inline), not the whole paragraph.
5. **Undo / Keep** covers everything: the text, the title, the icon and the banner. The chat shows Vappi's own `reply` (for example "Renamed the second heading and fixed 2 typos.").
6. **Unchanged:** the questions-vs-edits routing, the Free edit-only mode, the 60 edits/hour cap and the owner checks. The **Space** itself (name, goal date, files) stays out of scope; this is everything on the creation's page.
7. **Trade-off:** the plan arrives in one piece, so there are a few seconds of "Vappi is thinking…" before the edit starts typing (the pal shows reading, then writing).

## Files
- New: `lib/creations/edit-plan.ts` (schema + Zod types, shared).
- Changed: the edit route, `lib/ai/prompts.ts` (`EDIT_SYSTEM`, `editInput`), `lib/creations/types.ts` (event `plan`), `creation-editor.tsx` (build blocks, resolve + apply ops, Undo of title, icon and banner), `ai-range.ts` (inline ranges), `space-chat.tsx` (show `reply`), `editor-bridge.ts` (outcome carries the reply).

## Security
- Same owner, rate and size checks.
- The model output is validated with Zod, with length caps on every string.
- Emoji and banner values are validated server-side through the existing `setCreationLook`.
- Inserted Markdown goes through the same schema (unsafe links are stripped on save).
- Document text stays DATA (escaped); no document text in logs.

## Acceptance
- Highlight 3 words + "make this bold / change to X": only those words change and only they are tinted.
- No selection + "rename the second heading to Into the Cave": only that heading changes.
- "fix typos": only the misspelled words change.
- "add an item after X" adds one list item there.
- "change the title to …", "use a rocket emoji", "add a blue banner" work.
- "make it shorter" still rewrites the whole text.
- Undo restores text, title, icon and banner exactly.
- Works at 375 and 1280; no horizontal scroll.

## Checks
tsc, lint, build; headless Chrome with real Gemini for each acceptance line; Undo; security 401/404; clean up the test data.

## Manual test
1. Open a creation, highlight two words, and ask "make these bold": only they change.
2. With nothing selected, ask "rename the last heading to The End": only that heading changes.
3. Ask "change the title to Treasure Night and use a 🌙 icon with a dusk banner".
4. Ask "add an item after the first bullet saying they counted to 20".
5. Click Undo after any of them: everything returns.

## Added on approval
- Leaving and coming back resumes where you were: scroll position, cursor and the unsent chat draft (per Space).
- Leaving mid-writing keeps the creation "unfinished" (server saves it as WRITING); the editor offers "Continue writing" and the list says "unfinished".
- The riding pal glides after each word on a spring, leans as it moves, and reacts to the text: hops and happy eyes at "!" or exciting words, nods at list items, wiggles at questions and bold, a sad dip at sad words.

## Implementation notes
- The model JSON schema uses one `anyOf` variant per operation with its own required fields; without that the model sometimes left out `markdown`, and both attempts could fail. 6 of 6 plans were valid after the change.
- Plans arrive in about 1 second for short pages.
- Text is located exact, then case-insensitive, then without Markdown symbols. Overlapping steps are dropped and counted in the chat reply.
- Undo restores the title, icon and banner too.
