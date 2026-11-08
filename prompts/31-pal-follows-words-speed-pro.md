# 31 · The riding pal really follows each word; writing speed is Pro only

## Goal
1. The pal that rides along while Vappi writes or edits must sit **right after the last word being typed** and follow it word by word, reacting to the text (excited at "!", happy words, nods on list items, wiggles on questions or bold, a sad dip on sad words).
2. **Settings → Writing speed** is hidden for Free, and the server refuses it for Free.

## Diagnosis (headless trace of a real edit at 1280 px)
- The pal was on screen, but its x position stayed at **574 px** (the right edge of the document column) in almost every frame; only y changed as lines were added.
- Cause: `moveCaret` is given the end of a whole block (or the end of the document). ProseMirror's `coordsAtPos` at a block boundary returns the block's right edge, not the end of the last word.
- So the pal hugged the right margin instead of the words.

## Decisions
1. **Caret position:** `moveCaret(pos)` first snaps to the nearest real text position at or before `pos` (`TextSelection.near($pos, -1)`), then takes the coordinates of that cursor spot.
   - The pal therefore sits right after the last typed word: in the middle of a line, on the next line, or after a heading.
   - The same fix covers new creations, block rewrites, inserted list items and word-level changes.
2. **Livelier ride:**
   - The pal is a little bigger (26 → 30 px).
   - While Vappi is thinking before an edit, it already sits at the start of the part it will change (or at the top of the document), with the thinking face.
   - It gets a small nod on each new word.
   - The text reactions stay (hop with happy eyes at "!" or exciting words, a wiggle at "?" or bold, a nod at list items, a sad dip at sad words), but the gap between reactions goes from 350 to 250 ms so they're noticeable.
3. **Writing speed is Pro:**
   - `settings/page.tsx` shows the Vappi section only when `hasProAccess`.
   - `setWritingSpeed` returns `{ok:false}` for Free.
   - For Free, the creation page always uses Normal (so new creations, which Free can still make, type at the default pace).

## Files
`creation-editor.tsx` (moveCaret, thinking position, word nods), `caret-pal.tsx` (size), `settings/page.tsx`, `lib/settings/actions.ts`, the create page.

## Acceptance
- In a trace of a real edit and a new creation, the pal's x changes along the line, staying within about one word of the last character, and its y follows the lines.
- Reactions fire (happy eyes seen at "!" or exciting words).
- Free: no Vappi section in Settings, and the action refuses. Pro: unchanged.
- tsc, lint, build; test data cleaned.

## Implementation notes
- Three more causes found while testing, all fixed:
  - **New creations:** the half-written Markdown ends with a line break, which leaves an empty last paragraph, and the pal waited at the start of that empty line. It now aims at the end of the last line that has text (`lastTextEnd`).
  - **Lag:** with the soft spring (k = 70) the pal trailed about one word and covered the newest word. It's now k = 900, so it lands before the next word appears.
  - **Line wraps:** gliding diagonally to a new line swept across the words. Jumps over 80 px now hop straight there.
- Final placement: right after the last letter, on the same line (+8 px, −3 px).
- The Free check of Settings was not run in the browser: the user was changing subscriptions on Billing during the test, and I stopped touching billing rows.
