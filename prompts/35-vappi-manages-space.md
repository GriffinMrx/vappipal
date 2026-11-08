# 35 · Vappi can manage everything in a Space (side chat)

## Goal
In the side chat, the user can ask Vappi to change anything in the Space, not just the open document. For example:
- "rename this space to Biology 101, exam on 12 December"
- "delete the flashcards about Mark's dad"
- "make 5 flashcards from page 3"
- "rewrite the short summary of story.pdf simpler"
- "delete the quiz questions I already know"
- "make a checklist for kids"
- "rename Treasure Night to Treasure Email and delete the old notes"

Vappi is the user's pal for managing their things. Pro only, like the rest of the pal's AI.

## What I read / inspected
- `prisma/schema.prisma`: Space, Document, Summary, Flashcard, Question, PlanDay, Creation.
- `app/api/spaces/[spaceId]/chat/route.ts`, `lib/chat/*`: classifier, answer stream, Pro check, rate limit.
- `lib/creations/edit-plan.ts` and the edit route. The same pattern applies here: the AI returns a validated *plan* of small operations instead of doing things itself.
- The existing server actions, reused rather than rewritten:
  - `lib/spaces/actions.ts`
  - `lib/documents/actions.ts` (delete, retry, regenerate study material)
  - `lib/creations/actions.ts` (rename, look, duplicate, delete)
  - `lib/planner/*`
- `lib/ai/gemini.ts` (`generateJson` with a JSON schema).

## Decisions
1. **Ask vs manage:**
   - The chat classifier gets a third answer: **manage**, meaning the message asks to change things.
   - A question still gets the normal cited answer.
   - Edits to the open document still go to the document editor (prompt 28/29).
2. **Plan, then confirm. Nothing changes until the user says so.** Vappi answers with a card listing each change in plain words:
   - Example lines: "Rename Space → Biology 101", "Delete 3 flashcards", "Add 5 flashcards from story.pdf p. 3".
   - The card has **Do it** and **Cancel**.
   - Deletes are shown in red with "can't be undone".
   - After **Do it**, each line shows ✅ or ❌ with a short reason, and the Space refreshes.
3. **What Vappi can do.** The AI picks from this closed list only (Zod-validated, at most 40 per plan):

   | Area | Operations |
   |---|---|
   | Space | rename, color, goal date and label (set or clear) |
   | Files | rename, delete, retry a failed file, regenerate its summary, flashcards or quiz |
   | Learn: summaries | rewrite short or long, key terms |
   | Learn: flashcards | add, edit, delete, make due now |
   | Learn: quiz | add, edit or delete questions (multiple choice or short answer) |
   | Learn: plan | rebuild the plan |
   | Create | start a new creation (type + instruction; the card shows "Open" and it writes live as today), rename, change icon or banner, duplicate, delete |

   - Changing the *text* of a creation: Vappi offers "Open it", and the chat edits it there, as today.
4. **What Vappi sees:**
   - A compact list of the Space: names and ids of files, creations, flashcards (front text, up to 300), questions (up to 200), summaries, and the goal.
   - For new content: the closest excerpts from the files, with pages.
5. **Grounded:**
   - New or edited flashcards, questions and summaries come only from the user's files.
   - Each new card or question must give a document and page from the excerpts, otherwise the plan line is dropped.
   - If the files can't support a request, Vappi says so instead of guessing.
6. **Secure, checked again on Do it.** The client sends the confirmed plan back, and the server:
   - re-validates each operation (Zod);
   - re-checks that every id belongs to this user and this Space;
   - re-checks Pro;
   - runs it through the same logic the UI uses.

   A tampered plan can do nothing the user couldn't do by hand. Ids from other users simply fail.
7. **Limits:**
   - A plan counts as one chat message toward the hourly chat limit.
   - Applying a plan is capped at 20 per hour.
   - Free users still see the chat upgrade panel (pal AI is Pro only).
8. **Not optimistic:** this is AI work, so the card shows real progress and real results (AGENTS.md §7).
9. **Logs:** no file text, names or chat text, as always.

## Files
- New:
  - `lib/manage/plan.ts`: op schemas, JSON schema and parse
  - `lib/manage/context.ts`: the Space list for the AI
  - `lib/manage/apply.ts`: server-side execution, reusing the existing actions' logic
  - `lib/manage/actions.ts`: `applyManagePlan` server action
- Changed:
  - the chat classifier and route (new `manage` event: `{t:"manage", reply, ops}`)
  - `lib/ai/prompts.ts`: `MANAGE_SYSTEM`
  - `lib/chat/types.ts`
  - `components/chat/space-chat.tsx`: the plan card
  - a small `components/chat/manage-card.tsx`

## Acceptance (in the running app, real Gemini)
1. "rename this space to Biology 101 and set the exam to 12 December" → card with 2 lines → Do it → the header shows the new name and the goal.
2. "make 5 flashcards from page 2" → 5 cards, each citing a real page → Do it → Learn shows them, due now.
3. "delete the flashcards about X" → card lists exactly those (red) → Cancel → nothing changes. Then again → Do it → gone.
4. "rewrite the short summary simpler" → applied and visible in Learn.
5. "make a checklist for kids" → Open → it writes live.
6. "rename Treasure Night to Treasure Email" → renamed in the list.
7. A request the files can't support → Vappi says so, with no card.
8. A tampered plan (another user's id) → that line ❌, nothing else touched. Signed out → 401. Free → 403.
9. A normal question still gets a cited answer, and document edits still work.
10. Mobile: the card fits from 320px, with no sideways scroll.
11. Checks: tsc, lint, build; test data cleaned.

## Not in this prompt
- Uploading files from the chat.
- Billing.
- Undo for deletes (the confirmation covers it).

## Implementation notes
- **Short refs:** the model sees short refs (F1 file, C3 flashcard, Q2 question, D1 creation) instead of database ids. The server maps them back, and a ref it doesn't know is dropped.
- **Grounding:** a new card or question must cite an excerpt number; its file and page come from that excerpt, never from the model.
- **Card wording:** the card's lines are written by the server from real data (`describe` in `lib/manage/plan.ts`), not by the AI.
- **Speed:**
  - A clear command ("rename…", "please delete the cards…") needs no routing model call.
  - Unclear messages, and any message while a document is open, are decided by the fast model.
  - Planning uses minimal thinking.
  - On today's slow free Gemini, a plan took 3–22 s. Even a trivial call took 6–10 s.
- **Not built:** the "20 applies an hour" cap. Applying only does what the user could do by hand, and every plan already counts as a chat message.
- **Tested** on a throwaway clone of the Space; its file had a fake storage key, so deleting it couldn't touch the real upload. The clone was deleted afterwards. Results:
  - Rename and goal; color; file rename; file delete (cascades its summary, cards, questions and chunks).
  - 3 flashcards from page 2 (they match the page text); deleting the 8 "about Mark" cards (Cancel first, then Do it); making the cave cards due now.
  - Simpler summary; 2 multiple-choice questions (4 options, answer included, real pages).
  - New outline: Open writes it live. Creation rename and duplicate.
  - A question still gets the normal cited answer.
  - With a document open: a Space change gets a plan card, and the document is untouched; "make it shorter" still edits the document.
  - Tamper: another user's card and file were injected into the Do it request. Both were refused, and the real change still applied.
  - Signed-out chat: 401. A 320 px card has no sideways scroll.
