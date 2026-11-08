# 49 · Vappi edits: use every file in the Space, and stop saying "your files don't mention it" wrongly

## Goal
In a Space with several files (for example Calisthenics + Muay Boran), "get inspired from both my files and make a week program mixing calisthenics and Muay Boran" must use **both** files. Vappi should be free to do what the user asks, as long as it stays on the topics of the Space's files. It must also stop sending "edit the file…" messages to the Space-management helper.

## What I found (from your screenshot)
1. **Over-eager refusal (my rule from prompt 48).** The "STRICT check" makes Vappi say "your files don't mention X" whenever X isn't in the handful of excerpts it was given, even when a whole file is about X. You saw this: it read Muay Boran text and still refused.
2. **The search leans to the open page.** `creationContext` (`lib/creations/queries.ts`) searches with the instruction **plus the first 1,500 characters of the page**. The page is all calisthenics, so the 14 excerpts come almost only from the calisthenics file, and the Muay Boran file gets few or none.
3. **The edit never sees the per-file summaries.** The chat gets each file's title, summary and key terms (`<overview>`), but `editInput` only gets excerpts. So Vappi doesn't even know a Muay Boran file exists unless an excerpt happens to come from it.
4. **Wrong routing.** "now edit **the file** to fill my request" contains "edit" and "file", so it went to the Space-management helper. That's where "Please tell me what specific edits… to your files or study materials" came from. "The file" meant the open page.

## Decisions
1. **Every file is represented.** `creationContext` gets a per-file pass: for each Ready file in the Space, its 3 closest passages to the request (searched on the **instruction**, not the page text), plus the existing overall closest matches. The cap rises from 14 to 18 excerpts. `searchChunks` gets an optional `documentId` filter (still always filtered by user **and** Space, with tagged-template SQL only).
2. **The edit gets the overview** (each file's title, summary and key terms), like the chat does, so Vappi knows every file and its topic.
3. **Rule rewrite (`EDIT_SYSTEM`):**
   - "Inspired by / from my files / both files / mix X and Y" means use facts from all the files that fit and combine them freely (for example a week alternating calisthenics days and Muay Boran technique days).
   - Before saying the files don't cover something, check every file title, summary, key term and excerpt (any spelling or case). If any file is about it, use it.
   - Stay on the topics of the Space's files. Only something truly absent from all files (another sport, food or person) is declined, and Vappi does the rest.
   - Keep: no invented specific facts, keep existing items when rearranging, and a concrete reply.
4. **Routing fix:** with a creation open, a message that talks about "this/the file, page, document, program, text" or "my request" (and doesn't name another item in the Space) goes to the editor, not the management helper. The model note in `lib/manage/intent.ts` says the same.
5. New creations (`createInput`) also benefit from the per-file excerpts (same `creationContext`).

## Files to touch
- `lib/search/vector.ts` (`searchChunks` optional `documentId`)
- `lib/creations/queries.ts` (`creationContext`: per-file pass, instruction-first query, cap 18)
- `lib/ai/prompts.ts` (`EDIT_SYSTEM` rules, `editInput` + overview)
- `app/api/spaces/[spaceId]/creations/[creationId]/edit/route.ts` (query = instruction plus the last user turns, pass the overview, routing guard)
- `lib/manage/intent.ts` (doc note wording)

## Security
- The vector query still filters by user and Space, plus the document id. Parameters are tagged-template only.
- Overview and excerpts are DATA in escaped tags. Only the user's own files are used.

## Acceptance criteria
- Live Gemini test with two files (calisthenics + Muay Boran): "get inspired from both files, make a week program mixing calisthenics and Muay Boran" produces a week using exercises **and** techniques from both files, with no "your files don't mention" refusal.
- "add a swimming day" still declines swimming (not in any file).
- "now edit the file to fill my request" routes to the editor (rule check, without calling the model).
- Small edits ("make the title shorter") stay small. Type check, lint and build pass.

## Manual test steps
1. Open the Calisthenics + Muay Boran Space, open the program creation, then open Chat.
2. Type "get inspired from my both files and make a week program mixing calisthenics and muay boran". The page becomes a mixed week using both files.
3. Type "add a swimming day". It says your files don't mention swimming.
4. Type "now edit the file to make it shorter". The editor shortens it (no "Please tell me what specific edits…").
