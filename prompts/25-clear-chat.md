# 25 — Clear the Ask chat

The user wants an option to clear the AI chat of a Space (their screenshot shows a long Ask conversation).

## What I checked
- `components/chat/chat-panel.tsx`: the panel layout.
- `components/chat/space-chat.tsx`:
  - The header has Expand and Close buttons.
  - Message state is `confirmed` + `useOptimistic`.
  - A live answer runs while `live` is set.
- `lib/chat/queries.ts`: `listChatMessages` is scoped by user + Space.
- `ChatMessage` rows (user, space, role, content, citations, clientId).
- The delete-Space confirm dialog in `components/spaces/spaces-provider.tsx` (the `Dialog` component), as the pattern to reuse.

## Decisions
- **Where:** a "Clear chat" icon button (lucide `Trash2`, the same style as Expand/Close, 44 px on touch and 36 px from `lg`) in the chat header, before Expand.
  - It's shown only when there are messages.
  - It's disabled while an answer is streaming, so you stop it first.
- **Confirm first** (it can't be undone): a `Dialog` reading "Clear this chat?" / "All messages in {Space} will be deleted. Your files, summaries and cards stay." with the buttons **Cancel** and **Clear chat** (danger).
- **Optimistic (AGENTS.md §7 simple action):**
  - On confirm, the list empties at once and the welcome screen with the greeting pal shows.
  - If the server fails, the messages come back and an error toast shows ("Chat not cleared. Check your connection and try again."). Any draft in the composer is never touched.
  - On success, a small toast: "Chat cleared".
  - The inline error card and the "happy" state are reset too.
- **Server:** a server action `clearChat({ spaceId })` in `lib/chat/actions.ts`:
  - It re-checks the signed-in user and that the Space is theirs (otherwise "Space not found."), validated with Zod.
  - Then `deleteMany` runs where `userId` + `spaceId` match. It returns `{ ok, error? }` and never touches other Spaces or users.
  - No message text is logged.
  - Pro isn't required to clear: a user whose Pro ended can still delete their history.
- **Rate limits:**
  - The hourly chat limit counts messages over the last hour. Clearing would reset it, so the count moves to a tiny per-user counter, which keeps cost protection honest.
  - **Simpler choice taken:** the limit query counts `UsageEvent`s. Each sent chat message also records a `UsageEvent` of a new kind `CHAT` (a 1-line enum addition plus a migration).
  - The same applies to the regenerate limit (`REGENERATE`).
  - Old rows are not needed. The limits are hourly, so the switch-over is harmless.

## Files
- **New:** `lib/chat/actions.ts`, plus a migration for `UsageKind` `CHAT` and `REGENERATE`.
- **Edit:**
  - `prisma/schema.prisma` (enum);
  - `lib/chat/answer.ts` or the chat route, wherever a message is accepted (record usage);
  - `lib/chat/queries.ts` (count usage instead of messages);
  - `components/chat/space-chat.tsx` (button, dialog, optimistic clear).

## Security
- Ownership is checked on the server, and the delete is scoped by `userId` and `spaceId`.
- Signed out → the action refuses. Another user's `spaceId` → "Space not found.", and nothing is deleted.

## Acceptance criteria
- The trash button appears in the chat header once there's a message; it's disabled while answering.
- Confirm → the chat is empty instantly and stays empty after a refresh. Other Spaces' chats are untouched.
- Offline → the messages return, with an error toast.
- Clearing doesn't reset the hourly chat limit.
- Works and fits at 320 to 1920 px, in the docked, expanded and phone full-screen modes.

## Checks
- tsc, lint, build, and the migration on `dev`.
- Script tests:
  - the action as the owner clears only that Space;
  - another user and a wrong id → refused, nothing deleted;
  - the limit count is unchanged after clearing.
- Headless Chrome: button → dialog → cleared → refresh still empty; an offline rollback; screenshots at 375 and 1280.

## Manual test
1. Open a Space → Ask, and send a couple of messages.
2. Click the trash icon in the chat header → **Clear chat**. The chat empties and the pal says hi again.
3. Refresh: it's still empty.
4. Send a message, go offline (DevTools), and clear again. The messages come back with an error toast.

## Implementation notes (after building)
- **Server:**
  - `lib/chat/actions.ts` `clearChat` checks ownership, then runs `deleteMany` scoped by `userId` + `spaceId`, then `revalidatePath` on the Space.
  - Migration `20261107200000_usage_chat_kinds` adds `CHAT` and `REGENERATE` to `UsageKind`.
  - The chat route records one usage event per accepted send or regenerate, before answering.
  - `chatAllowance` and `canRegenerate` now count those events, not the messages.
- **UI** (`space-chat.tsx`):
  - The trash button shows only when there are messages and is disabled while answering.
  - It opens a `Dialog` confirm.
  - The clear itself goes through `useOptimistic` (the reducer accepts `"clear"`).
  - The chat panel's Esc handler now ignores Esc while a modal dialog is open.
- **Tested** with a temporary Space on the user's account (deleted afterwards), so their real chat history was never touched:
  - offline → the 4 messages stay, with the "Chat not cleared" toast;
  - online → cleared in 25 ms with the "Chat cleared" toast; the welcome pal shows; still empty after a refresh;
  - the other Spaces' 26 messages are untouched, and the CHAT usage count is unchanged (2) after clearing;
  - no horizontal scroll at 375 / 1280;
  - Esc closes only the dialog.
- **Not tested end to end:** calling the action as another user or signed out (ownership is checked in code). Create moves to prompt 26.
