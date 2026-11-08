# 33 · Writing speed applies at once (no reload)

## The bug
After changing **Settings → Writing speed**, an editor opened inside the app (or already open in another tab) keeps the old speed until the page is reloaded.

Cause:
- The creation page reads `writingSpeed` on the server and passes it to the editor once.
- Client navigation reuses the page it already loaded (the router cache), and an open tab never asks again.
- The Settings choice is optimistic only inside Settings.

## Decisions
1. **One speed store in the browser** (`components/settings/writing-speed-store.ts`, a tiny external store like `palStore`):
   - Holds `{ speed, at }`, mirrored to `localStorage`.
   - Updated live across tabs (the `storage` event).
2. **Settings** writes to the store the moment you pick (optimistic), then saves on the server as today. If the save fails, the store goes back to the old value along with the radio, and the error toast shows.
3. **The editor** reads the store with `useSyncExternalStore`:
   - The server value is the fallback.
   - A stored value wins only if it's newer than the user record's `updatedAt` (passed by the page), so a change made on another device isn't overridden by an old local value.
   - Free users stay on Normal (the setting is Pro).
4. **Applies even mid-typing:** the typewriter takes a pace *getter* and reads it on every tick, so switching speed changes the pace right away, even while Vappi is writing.

## Files
New `components/settings/writing-speed-store.ts`. Changed: `writing-speed-settings.tsx`, `creation-editor.tsx`, `typewriter.ts`, the create page (passes `speedAt`).

## Acceptance
- Change the speed in Settings, then go to a creation through the sidebar (no reload): the new pace is used. Measured with a timed edit or new creation.
- An editor open in a second tab picks up the change without a reload.
- A failed save (offline) rolls back the store and the radio.
- tsc, lint, build; your setting put back as it was; test data cleaned.

## Implementation notes
Measured with real AI edits, in the same tab with no reload:

| Path | Speed picked | Measured |
|---|---|---|
| Settings → Back | Instant | appears at once (609 chars/s) |
| Settings → Back | Calm | 25 chars/s |
| Settings → Back | Normal | 44 chars/s |
| Another tab | Fast | ~100 chars/s |

An offline save rolls back both the radio and the stored value.
