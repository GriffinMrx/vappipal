# 30 · Pro-only AI editing, a new animated AI icon, no toolbar "Ask Vappi", writing speed setting

## Goal
1. **Security fix:** AI editing of documents is Pro. Today a Free user gets an "edit-only" side chat on a creation, and the edit route checks only ownership, not the plan. Gate it on the server and in the UI.
2. Replace the outline sparkles icon on AI buttons with a **solid** icon that **animates** (it's AI).
3. Remove the **Ask Vappi** button from the editor toolbar (the side chat, the Chat key and the selection button are enough).
4. **Settings → Vappi's writing speed** for typing new documents and live edits.

## What I read
- `app/api/spaces/[spaceId]/creations/[creationId]/edit/route.ts` (no Pro check), `components/chat/space-chat-slot.tsx` (`forCreation` → `editOnly` for Free), `space-chat.tsx` (`editOnly` paths).
- Sparkles usages: `chat-panel.tsx` (Chat key), `create-panel.tsx` (Create button), `creation-editor.tsx` (floating Ask Vappi), `editor-toolbar.tsx` (toolbar Ask Vappi), `ask-intro.tsx`, `ui/ai-button.tsx` (Generate buttons on summaries and documents).
- `app/(app)/settings/page.tsx` + `components/settings/reminder-settings.tsx` + `lib/reminders/actions.ts` (the optimistic switch pattern); `components/create/typewriter.ts`.

## Decisions
1. **Pro gate (server is the source of truth):**
   - The edit route returns `403 {error:"pro"}` unless `hasProAccess`. This runs after the owner check and before the classifier or any AI call, so nothing is counted.
   - On a creation page, Free users get the existing **Chat upgrade panel**; the `editOnly` mode is removed.
   - In the editor (the page passes `canUseAi`), Free users get no floating selection button. Their "Continue writing" bar becomes "Vappi didn't finish this. Upgrade to Pro to let Vappi continue it", with an **Upgrade** link.
   - Making new creations stays as it is (Free: 3 a week, AGENTS.md §7).
2. **Icon:** a new `AiIcon` component made of lucide `Sparkle` stars, **filled** (solid): one big star and one small star.
   - It plays a gentle twinkle: the big star breathes and turns slightly, and the small one blinks, in a loop.
   - It plays faster while the button is busy, and stays still with reduced motion.
   - It's used on the Chat key, Create, the floating Ask Vappi, the Ask intro and `AiButton`. The thinking indicator keeps its icon (it isn't a button).
   - No duotone placeholders (your duotone set stays user-supplied).
3. **Toolbar:** the Ask Vappi button and its prop are removed.
4. **Writing speed:**
   - New `User.writingSpeed` enum `CALM | NORMAL | FAST | INSTANT`, default NORMAL, added by a migration on the dev branch.
   - | Speed | Characters per second | Catch-up |
     |---|---|---|
     | Calm | 25 | 40 s |
     | Normal | 45 | 25 s (today's pace) |
     | Fast | 110 | 10 s |
     | Instant | no animation | — |
   - Settings has a new **Vappi** section: a 4-option segmented choice, optimistic (rolls back with a toast if the save fails). Server action `setWritingSpeed` with a Zod enum.
   - The creation page reads it and passes it to the editor, so the typewriter uses it for writing, edits and title typing.
   - On phones the options wrap into 2×2.

## Files
- New: `components/ui/ai-icon.tsx`, `lib/settings/actions.ts`, `components/settings/writing-speed-settings.tsx`, migration `…_user_writing_speed`.
- Changed: the edit route, `space-chat-slot.tsx`, `space-chat.tsx` (remove `editOnly`), the create page, `creation-editor.tsx`, `editor-toolbar.tsx`, `typewriter.ts`, `chat-panel.tsx`, `create-panel.tsx`, `ask-intro.tsx`, `ai-button.tsx`, `settings/page.tsx`, `globals.css` (keyframes), `prisma/schema.prisma`.

## Security
- Pro is enforced in the route (the UI only hides).
- The speed action re-checks the signed-in user and validates the enum.
- No secrets or document text are logged.

## Acceptance
- Free: the edit route answers 403 `pro` (verified with a real Free session); the creation page shows the upgrade panel and no selection button.
- Pro: unchanged.
- The new icon is solid and animated on every AI button; the toolbar has no Ask Vappi.
- Settings → speed changes save, survive a refresh, and change the pace in the editor (Instant shows the text at once).
- No horizontal scroll from 320 to 1920 px.

## Checks
- tsc, lint, `migrate deploy` + `generate` on the Neon `dev` branch, build.
- Headless Chrome: the Free gate (the account is Free right now), Settings at 375 and 1280, and the toolbar.
- The Pro editing pace per speed is measured only if the account is Pro (it isn't now; billing won't be touched).

## Manual test
1. As Free, open a creation: the side chat shows the upgrade panel; selecting text shows no Ask Vappi.
2. Settings → Vappi → choose **Fast**, then refresh: it stays on Fast.
3. As Pro, ask Vappi to edit a document: the pace follows the setting.
4. Look at Chat, Create and Generate: solid, twinkling icon.
