# 48 · Vappi edits: do whatever the user asks, with facts from the files only

## Goal
In the Create editor's side chat, Vappi should do **any** change the user asks for (mix, combine, merge, reorganise, compare, adapt for someone, turn into a plan…) as long as every fact comes from the user's files or the page itself. It should no longer refuse because "the files don't contain a combined routine". It must also understand follow-ups like "yes", "do it" and "for both of them", and say clearly what it changed.

## What I found (from your screenshot)
1. **The refusal comes from the edit instructions.** `EDIT_SYSTEM` in `lib/ai/prompts.ts` says: *"If the request can't be done (for example it needs facts that aren't in the files), return no ops and say why."* The model read "mix the program for both of them" as needing facts the files don't have (a ready-made combined routine). Mixing exercises that are already on the page and in the files is a **transformation, not a new fact**, but the instructions never say so.
2. **The edit has no memory of the chat.** `components/chat/space-chat.tsx` → `target.edit(message, …)` → `POST …/creations/:id/edit` sends only the new message. So "both of them" (referring to earlier messages) and "yes" have nothing to point to. That's why Vappi answered "yes" with the empty *"I have processed your request."*
3. **"The AI is busy right now"** is a Gemini overload or rate-limit (503/429) on the single edit call (`generateJson` has no retry, by design). One quick automatic retry would hide most of these blips.

## Decisions
1. **Rewrite the edit rules (`EDIT_SYSTEM`)** to be flexible but grounded:
   - Do whatever the instruction asks: combine, mix, merge, split, reorder, regroup, compare, schedule into days or weeks, adapt for a person or level, shorten, expand, change format or tone, and so on.
   - Facts = anything already on the page **plus** `<file_material>`. Rearranging, combining, picking, counting, ordering and scheduling those facts is always allowed. Never refuse because the files don't contain the finished result.
   - Only specific new facts that appear nowhere (a new exercise, number, name or claim) may not be invented. Do everything else that's possible, then say in `reply` what was missing.
   - Return no ops only when literally nothing on the page or in the files can serve the request.
   - `reply` must say concretely what changed ("I mixed the push and pull days into one 5-day program…"), never a generic "I have processed your request."
2. **Send recent chat history with each edit:** the last 8 messages of the side chat (user messages plus Vappi's replies or edit summaries, each trimmed to 600 characters). The model gets it as `<history>` (DATA, only for understanding follow-ups, never a source of facts). Zod-validated on the server: max 8 items, 600 characters each.
3. **Same flexibility for new creations:** `CREATE_RULES` gets one line saying the instruction may ask for any arrangement (combine, compare, plan, adapt), and facts still come only from the files.
4. **Busy retry:** in the edit route, if the AI call fails with a busy or rate-limit error, wait 2 s and try once more before showing the busy message. The daily-limit error is still shown at once.
5. No UI changes. The classifier (`intent.ts`) already routes "now edit…", "yes" and "do it" to edit.

## Files to touch
- `lib/ai/prompts.ts` (`EDIT_SYSTEM`, `editInput` + history, `CREATE_RULES` line, `history` in the escaped tags list)
- `app/api/spaces/[spaceId]/creations/[creationId]/edit/route.ts` (accept `history`, busy retry)
- `components/create/editor-bridge.ts` + `components/create/creation-editor.tsx` (pass history through `edit`)
- `components/chat/space-chat.tsx` (build the last-8 history and pass it)

## Security
- History and messages are untrusted DATA wrapped in escaped tags. They can't change rules or output format, and are never a source of facts.
- Still owner-only, Pro-only and rate-limited. Facts only from the user's own files and page. Nothing new is logged (no message text in logs).

## Acceptance criteria
- On a page with a pull day and a push day: "mix the program for both of them" (after a chat that mentions both) produces a mixed program using only exercises from the page or files, with a concrete reply.
- "yes" after Vappi offers a change carries out that change.
- A request for a fact that's nowhere in the files gets a partial edit and a reply naming what's missing. No invented facts.
- A busy blip retries once automatically. Type check, lint and build pass.

## Checks
- `npx tsc --noEmit`, lint, `npm run build`.
- A live test of the edit route against Gemini (dev key) with a page like the screenshot: mix request, "yes" follow-up, missing-fact request, and a normal small edit ("make the title shorter") to confirm small edits still touch only what was asked.

## Manual test steps
1. Open a creation with a push day and a pull day, then open Chat.
2. Type "now edit this file to mix the program for both of them". Vappi rewrites it into a mixed program and says what it did.
3. Ask "add a day for swimming" when the files have no swimming. It says swimming isn't in your files and adds nothing invented.
4. Type "make the title shorter". Only the title changes.
