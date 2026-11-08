# 34 · Writing speed: always the latest, from any device or address

## The bug (reproduced)
- Editor open at `http://localhost:3000/...` (the PC).
- Speed changed in Settings at `http://192.168.11.133:3000/settings` (the LAN address the dev log shows in use; a phone is the same case).
- The database saves the new speed (INSTANT), but the editor keeps typing at the old pace (45 chars/s, Normal) until it's reloaded.

## Cause
Prompt 33 made the speed live through `localStorage` plus the `storage` event. Browsers keep that storage per address (origin):
- `localhost` and `192.168.11.133` don't share it.
- Neither does another device or another browser.

The editor's only other source is the page's server props, read when the page loaded, so a change from anywhere else needs a reload.

## Decisions
The server, which is the source of truth, tells the editor the speed whenever Vappi writes.

1. **At the start of every run:**
   - The generate route (`POST /creations`, which covers new, regenerate and continue) and the edit route send `{ t: "speed", speed }` as their first event, read fresh from the database.
   - Free users always get NORMAL; the setting is Pro.
   - The editor switches to it before any text is typed.
2. **While typing:**
   - The editor asks `GET /api/settings/writing-speed` (owner only, `no-store`, a tiny response) every 3 s, only while Vappi is writing.
   - If the server's value changed since the last check, it switches straight away, so a change from your phone applies mid-typing too.
3. **Same browser:** the local store from prompt 33 stays, so a change made in this browser still applies instantly, with no wait.
   - When the server reports a speed, the editor also updates the local store, so every tab on this address agrees with it.
4. **Last change wins:** the editor reacts only to a *change* in each source, so an older value can't override a newer one, whatever the device clocks say.

## Files
- New `lib/settings/writing-speed-server.ts` (`currentWritingSpeed(userId)`).
- New `app/api/settings/writing-speed/route.ts`.
- Changed:
  - `lib/creations/types.ts` (new event)
  - both stream routes
  - `components/create/creation-editor.tsx`
  - `components/settings/writing-speed-store.ts` (`adopt`)

## Security
- The GET route requires a signed-in user and returns only that user's own speed.
- Nothing about files or chats is logged.

## Acceptance (all measured in a real browser, no reload)
1. Editor on localhost; Settings on the LAN address → Instant → next edit appears at once; → Calm → next edit types at about 25–40 chars/s.
2. The same holds for a new creation.
3. Mid-typing: a long creation is writing on localhost when the LAN address picks Instant → the rest appears within about 3 s.
4. Same-browser paths from 33 still work: Settings → Back, and another tab.
5. GET route: 401 when signed out; Free users get NORMAL.
6. Checks: tsc, lint and build pass; your setting is put back; test data is deleted.

## Implementation notes
Measured in a real browser, never reloading the editor. Characters added per second while Vappi typed:

| Where the speed was changed | Picked | Next run on localhost |
|---|---|---|
| LAN address (`192.168.11.133`) | Calm | edit: 25 chars/s (twice) |
| LAN address | Instant | edit: at once (500–900 chars in 0.1 s) |
| LAN address | Fast | edit: 107 chars/s |
| LAN address | Instant | new creation: 1,920 chars in 1.3 s, as fast as the AI sent them |
| LAN address | Fast | new creation: 118 chars/s |
| LAN address, mid-typing | Calm → Instant | the rest appeared 2.8 s later |
| Same tab (Settings → Back) | Instant / Calm | at once / 25–33 chars/s |
| Another tab, same address | Fast | 100–107 chars/s |

Other checks:
- An offline save in Settings still rolls back.
- `GET /api/settings/writing-speed` returns 401 when signed out.
- A Free user with INSTANT stored still gets NORMAL.

## Follow-up: reload after saving (the user's request)
After a speed is saved in Settings, the page reloads (`window.location.reload()`), so the whole app starts fresh with the new speed. A failed save doesn't reload; it rolls back and shows "Not saved".

Verified: the speed was picked in Settings (the page reloads), then Back to the document and an edit:

| Picked | Measured |
|---|---|
| Fast | 108 chars/s |
| Instant | appears at once |
| Calm | 25 chars/s |
| Normal | 44 chars/s |

Offline: no reload, the choice rolls back, and the toast shows.
