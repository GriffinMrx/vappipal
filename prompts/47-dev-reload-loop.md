# 47 · Dev server reload loop after clearing the cache

## Goal
Stop the "app crashes on reload / after clearing the cache" problem in development, and give a safe one-command way to clear the cache.

## What I found (evidence)
- `.next/dev/logs/next-development.log` from the session started at 22:11: the browser **fully reloaded 88 times in ~35 s** (a fresh "React DevTools" boot line every ~0.4 s, each followed by a server "✓ Compiled in 0ms").
- I reproduced it against that same server at 22:15 with a headless browser: about 10 page loads in 8 s on every page (`/`, `/sign-in`, `/unsubscribe`), on both `localhost` and the LAN address.
- The HMR WebSocket showed why: the server sends `{"type":"reloadPage","data":"HMR hash mismatch"}`. The page HTML was rendered at HMR version 466, but by the time the browser subscribed the server was at 467, so it reloads, the reload bumps the version again (468, 470…), and so on. Source: `node_modules/next/dist/server/dev/hot-reloader-turbopack.js` (the `turbopack-subscribe` check). The version only goes up when Turbopack reports a client or server-component change. That server had produced ~470 changes, while a healthy server stays at 0 when idle.
- After the server was restarted (22:17), the loop was gone: one page load in 8 s, and the version stayed at 0.
- **Not reproducible on demand.** In a separate copy on port 3100 I tried a cold cache with 3 tabs at once, `next build` while dev ran, deleting `.next` under a running server (Next 16 detects it and restarts itself cleanly), and killing the server mid-compile. None of these looped.
- Your `.next` still contained files from before the "clear" (`BUILD_ID` from 22:06, `cache/` from Nov 5), so the delete only partly happened. The most likely trigger is a half-cleared or stale Turbopack dev cache, which makes Turbopack report "changes" on every request. It's a dev-only Next.js 16.4.5 behaviour, not app code. Production builds don't have HMR.
- Second finding: on the LAN address (`http://192.168.11.133:3000`) Clerk logs "Suffixed cookie failed … secure-context: false" and does several handshake redirects. Browsers block the crypto Clerk needs on plain http (already noted in `next.config.ts`), so sign-in there is unreliable. Use `npm run tunnel` for phones.

## Decisions
1. Add `npm run dev:clean` (`scripts/dev-clean.mjs`, plain Node, works in PowerShell and bash):
   - Reads `.next/dev/lock`. If that process is still alive, it stops with "Stop `npm run dev` first (Ctrl+C), then run this again." It never kills your server.
   - Deletes `.next` completely with `fs.rmSync` and retries for Windows file locks (EBUSY/EPERM). If anything is left, it says which file and exits.
   - Then starts `next dev` (same output as `npm run dev`).
2. Add a short "Troubleshooting" section to `README.md`: what the loop looks like, the fix (`Ctrl+C`, then `npm run dev:clean`, then reopen **one** tab), and "use `npm run tunnel` instead of the LAN address for phones".
3. No change to app code, because nothing in the app causes this.

## Files to touch
- `scripts/dev-clean.mjs` (new), `package.json` (script), `README.md` (troubleshooting).

## Security
- Local dev script only. It deletes only `<project>/.next`, a path resolved from the script's own folder and checked, never from user input.

## Acceptance criteria / checks
- With the dev server running, `npm run dev:clean` refuses and leaves `.next` alone.
- With it stopped, it removes all of `.next` (no leftover files) and starts dev. `/` loads once with no reload loop, and the HMR version is 0.
- Lint passes on the script.

## Manual test steps
1. With `npm run dev` running, open a second terminal and run `npm run dev:clean`. It should refuse.
2. Press Ctrl+C in the first terminal, then run `npm run dev:clean`. `.next` is rebuilt and the server starts.
3. Open http://localhost:3000 in one tab. It loads once and doesn't keep reloading.
