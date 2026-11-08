# 24 — Match the new app idea: Vappi is "your AI pal for your own files" (Spaces)

AGENTS.md changed. Vappi is no longer a study app for students and their courses. It's **an AI pal for anyone's own files about any topic**:
- A user makes a **Space** (Biology, a business plan, Cooking, a work project) and uploads files.
- They work with the Space in three modes: **Learn**, **Ask** and **Create**.
- A **goal date** (optional, with a label like Exam / Presentation / Deadline) builds a daily plan.
- The paid pass is the **30-Day Pass**.
- Free now includes **3 creations a week**.

This prompt re-aligns everything that already exists to that idea. The **Create** mode itself (the five output types, streaming, saved creations) is a new feature and gets its **own** prompt next (25), as one feature per prompt.

## What I checked
- **Old wording:** about 118 files use the study wording. Across `app`, `components` and `lib`: "subject" about 840 times, "exam" 92, "student" 78, "study" 71, "course" 47, "Exam Pass" 19.
- **Routes:** `/subjects`, `/subjects/[subjectId]`, `/planner`, `/home`, `/billing`, `/settings`.
- **Subject page tabs** (`components/subjects/subject-tabs.tsx`): documents, summary, flashcards, quiz, plan. Chat is the side panel.
- **Prisma:** `Subject {name, examDate, color}`, `StudyPlanDay`, and `subjectId` on Document, Chunk, Flashcard, Question, ChatMessage.
- **`lib/plans.ts`:** `EXAM_PASS_DAYS`, `PRICE_EXAM_PASS`, `LEMONSQUEEZY_VARIANT_EXAM_PASS`, and `FREE_LIMITS` without creations.
- **AI prompts:** `lib/ai/prompts.ts` speaks to a "student" about their "course". The chat route and `classifyIntent` describe "your course notes".
- **Other surfaces:** the reminder email copy, the landing page `app/page.tsx`, and billing feature lists.

## Decisions

### 1. What the user sees (all copy)
- **Words:**
  - Subject → **Space**.
  - Course / notes → **files**.
  - Study → **learn**.
  - Exam date → **Goal date**, with a **goal label**.
  - Exam Pass → **30-Day Pass**.
  - Student → *you*, with no role assumed.
  - Example names in placeholders: "Biology, My business plan, Cooking…".
- **Space page:** three modes as the top-level tabs. They reuse the existing pill tabs:
  - **Learn:** sub-tabs Summary · Flashcards · Quiz · Plan.
  - **Ask:** opens the chat. The chat stays the side panel, and the Ask tab is just a clear entry point that opens or expands it.
  - **Create:** for now a "coming next" empty state. It's built in prompt 25.
  - **Files** (the document list) stays visible above the modes, as the Space's status area.
- **Goal planner:**
  - "Exam plan" → "Plan to your goal".
  - "Days until your exam" → "{n} days until {goal label}".
  - The label picker offers Exam, Presentation, Deadline, Launch and Other (custom text, 40 characters max).
  - The planner math is unchanged.
- **Billing:**
  - "Exam Pass" → "30-Day Pass" everywhere.
  - Feature lists become: Free "3 creations a week"; Pro "Create: notes, outlines, checklists, emails, blog posts".
  - The Create limit only takes effect once Create exists (prompt 25). It's listed on the page now so the plans read right.
- **AI pal / brand:** the tagline "Vappi, your AI pal for your own files" shows in the empty states and on the landing page.
- **AI prompts:** written for anyone ("the user's files"), with no student framing. The rules stay the same: grounded, cite pages, say when it's not in the files.
- **Email:** reminder copy says "your Space" and "{goal label}".

### 2. URLs
- `/subjects` → **`/spaces`** and `/subjects/[id]` → **`/spaces/[id]`**.
- Permanent redirects from the old paths go in `next.config` `redirects()`, so old links and emails still work.
- `/planner` stays, with the title "Plan".
- Tabs: `?mode=learn&tab=flashcards`, `?mode=ask`, `?mode=create`.

### 3. Data (one small migration on the `dev` branch)
- Add **`Subject.goalLabel String?`**.
- Rename `examDate` → `goalDate` with `@map("examDate")`, so there's no data rewrite.
- **Recommended: rename models in code only, keep the tables.**
  - `Subject` → `Space` with `@@map("Subject")`.
  - `subjectId` fields → `spaceId` with `@map("subjectId")`.
  - `StudyPlanDay` → `PlanDay` with `@@map("StudyPlanDay")`.
  - `SubjectColor` → `SpaceColor` with `@@map`.
  - The database stays as it is (zero data risk). The code then matches AGENTS.md (§8 "A Space…", "A plan day…").
  - It's mechanical, and tsc catches every miss.
- Identifiers rename to match:
  - `lib/subjects` → `lib/spaces`;
  - `components/subjects` → `components/spaces`;
  - `subjectId` → `spaceId`;
  - the `EXAM_PASS` constants and env → `PASS_30_DAY` (`PRICE_PASS`, `LEMONSQUEEZY_VARIANT_PASS`). The old env names are still read as a fallback, so the user's `.env.local` keeps working; `.env.example` is updated.
- Plan values: the stored `plan`/`kind` value `exam_pass` → `pass`, through a data update in the same migration. That's 1 cancelled mock row today, the user's own; its status isn't touched.
- The `FREE_MAX_CREATIONS_PER_WEEK=3` config is added to `lib/plans.ts`. It's enforced in prompt 25.

### Not in this prompt
- The Create mode itself (prompt 25).
- Lemon Squeezy (still last).
- No visual redesign beyond the new tabs.

## Security
- Nothing changes in auth or scoping. Every query is still filtered by the user and the Space.
- The redirects are static paths, with no user input in them.
- The migration runs on the `dev` Neon branch only.

## Files (expected)
- **Prisma:** `prisma/schema.prisma` plus 1 migration.
- **Moved:** `app/(app)/subjects/**` → `app/(app)/spaces/**`, `lib/subjects` → `lib/spaces`, `components/subjects` → `components/spaces`.
- **Edits:** every file that imports them, plus `lib/plans.ts`, `lib/billing/*`, `lib/ai/prompts.ts`, `lib/chat/*`, `lib/planner/*`, `lib/reminders/*`, `lib/email/*`, `components/**` copy, `app/page.tsx`, `next.config.ts` (redirects) and `.env.example`.

## Acceptance criteria
- No user-facing "subject", "course", "exam" (except as a goal label choice), "student" or "Exam Pass" anywhere. Checked with grep and by clicking through every page.
- `/subjects/...` redirects to `/spaces/...`.
- A Space page shows the Files area plus **Learn · Ask · Create**. Learn holds Summary, Flashcards, Quiz and Plan, and they all work as before. Ask opens the chat. Create shows its "coming next" state.
- Goal date plus label: setting "Presentation, Dec 12" shows "35 days until Presentation" and rebuilds the plan.
- Billing says 30-Day Pass. The mock checkout for the pass still works and gives 30 days.
- Existing data (the user's Space, documents, cards, chat, mock subscription) is all still there after the migration.
- 320 to 1920 px: the new mode tabs fit with no horizontal page scroll.

## Checks
- `prisma migrate` (diff plus deploy on `dev`), `prisma generate`, tsc, lint, build.
- Signed-in route tests: chat, planner and billing actions.
- Headless Chrome on every page at 320, 768, 1280 and 1920 px.
- A grep for the old words in user-facing strings.

## Manual test
1. Open the app. The sidebar says **Spaces**. Open your Space and see Files, then Learn · Ask · Create.
2. Learn → Flashcards and Quiz still work. Plan shows "{n} days until {label}".
3. Edit the Space: set the goal to "Presentation" and a date. The plan updates.
4. Ask → the chat opens. "What is this about?" is answered with page links.
5. Billing shows the **30-Day Pass**.
6. Visit an old `/subjects/...` link and land on `/spaces/...`.

## Implementation notes (after building)
- **Database:**
  - Migration `20261107180000_space_goal_label` adds `goalLabel` and sets it to "Exam" wherever a date already existed.
  - All other renames are code-only through `@map`/`@@map`:
    - `Subject` → `Space` (`@@map("Subject")`);
    - `subjectId` → `spaceId` (`@map("subjectId")`);
    - `examDate` → `goalDate` (`@map("examDate")`);
    - `StudyPlanDay` → `PlanDay`;
    - `SubjectColor` → `SpaceColor`;
    - the enum value `EXAM_PASS` → `PASS` (`@map("EXAM_PASS")`), so no row was rewritten.
  - Verified: the existing pass row reads back as `PASS`, and a new pass order is stored as `EXAM_PASS`.
- **Raw SQL still uses database names.** After the blanket rename, the vector search said `"spaceId"`, and chat failed ("Couldn't answer right now"). It's fixed back to `"subjectId"`, with a comment. This is the only raw SQL that names the column.
- **URLs: deviation from the plan.** I kept one `?tab=` parameter instead of `?mode=…&tab=…`, so every existing link (plan tasks, quiz tokens, summary links, old `?tab=chat`) keeps working.
  - Modes are derived from the tab: `documents` → Files; `summary` / `flashcards` / `quiz` / `plan` → Learn; `ask`; `create`.
  - `?tab=learn` and `?tab=chat` are still accepted.
- **Files is a top-level tab** (Files · Learn · Ask · Create) rather than an area above the modes. A long file list would push the modes off screen. The header line still shows the document count and the goal.
- **Ask** opens the side chat; the main area shows the pal with "Ask anything about {Space}". **Create** shows its "coming next" state (prompt 25).
- **Renames:**
  - folders: `/subjects` → `/spaces`, `/api/subjects` → `/api/spaces`, `lib/subjects` → `lib/spaces`, `components/subjects` → `components/spaces`;
  - `course-chat.tsx` → `space-chat.tsx` (`SpaceChat`);
  - 308 redirects for `/subjects` and `/subjects/:id`;
  - Inngest was re-synced.
- **Goal label:**
  - `lib/spaces/goal.ts` holds `GOAL_PRESETS`, `goalName` and `goalCountdown` ("12 days until Presentation").
  - The form has preset chips (Exam / Presentation / Deadline / Launch / Other, with a 40-character custom box).
  - The label is used in the header, cards, Home, Plan, the planner and the reminder email.
- **AI prompts:**
  - The tags became `<file_material>`, `<user_answer>` and `<user_question>`. `escapeTags` still neutralises the old names too.
  - The wording is for anyone's files. The chat calls itself "Vappi, your AI pal".
- **Env:** `PRICE_PASS` and `LEMONSQUEEZY_VARIANT_PASS`, with fallback to the old `*_EXAM_PASS` names. `FREE_MAX_CREATIONS_PER_WEEK=3` is added and shown on Billing; it's enforced in prompt 25.
- **Kept:**
  - the storage bucket name `course-files`, which is real infrastructure;
  - internal folder names `components/study` and `lib/study` (not user-facing);
  - the duotone icon name `exam`.
- **Tests:**
  - 12 pages × 4 widths (320/768/1280/1920): all 200, no horizontal scroll, no page errors. The only old wording on screen is an earlier saved chat reply.
  - Goal label through the real UI: the change shows in about 20 ms (optimistic), persists after a reload, a custom label reaches the planner, and the original was restored.
  - The chat route answers "who are you" in the new wording, and a file question with page 18.
  - Planner rebuild works, and the email text reads "(12 days until Presentation)".
  - The test chat messages and the test pass order were deleted.
