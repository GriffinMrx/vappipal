# 32 · Fix: new creations cut off after changing the speed in Settings

## The bug (reproduced)
Steps: Settings → pick a speed → go back to the Space through the sidebar → Create → Checklist + an instruction → Create.

Seen in headless Chrome:
- The creation request is aborted 2 seconds in (`/api/spaces/…/creations ERR_ABORTED`).
- The server stores only what arrived until then (455 characters, READY).
- The page shows a short or empty document.

When the page is loaded fresh, all four speeds work.

## Cause
- While writing, the editor swaps the address bar from `/create/new?…` to `/create/<id>` with `window.history.replaceState`. In this Next.js version that call is wired into the router (`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`, "Native History API").
- After a server action has marked the router state stale (the Settings save calls `revalidatePath`), the router fetches and renders the page for the new address.
- The editor's `key` is built from the route param (`new` → `<id>`), so React remounts it. The unmount aborts the stream, and the new editor loads the half-written copy.

## Decisions
1. **Swap the address only after Vappi has finished** (after `done` and the final content, or after an error). If the router renders `/create/<id>` then, it loads the complete saved creation, so nothing is lost.
2. **Refreshing mid-writing doesn't create a duplicate:**
   - Each Create / Regenerate click adds a one-time `n=<timestamp>` to the `/create/new` link.
   - When the server answers `created`, the editor stores `id` under that address in `sessionStorage`.
   - If the same `/create/new?…n=…` address is opened again in this tab (a refresh while writing), the page goes to `/create/<id>` instead of writing a second one, where the server's copy or the "Continue writing" bar takes over.
3. **The "where you left off" restore** runs only on the editor's first mount for an existing creation, never during writing.

## Files
`components/create/creation-editor.tsx`, `components/create/create-panel.tsx` (adds `n`), the regenerate link in the editor.

## Acceptance
- The exact steps above, with each of Calm, Fast and Instant: the full creation is written, the request is not aborted, the server copy matches the screen, and the address ends as `/create/<id>`.
- Refreshing during writing opens the same creation (no duplicate).
- Fresh-load creation still works.
- tsc, lint, build; test data cleaned; the speed setting put back to what it was.

## Implementation notes
- A second bug turned up while testing: the editor's unmount cleanup set `leaving = true`, and React's development double-mount runs that cleanup once on purpose, so in dev the editor always thought the user had left. As a result the address swap never ran and Stop didn't save what was on screen. The flag is now reset on every mount.
- The `ERR_ABORTED` line for `/creations` also appears on a fresh page load where everything works: it's how headless Chrome reports a stream the page read to the end, not this bug.
- Short server copies (about 450–770 characters) are normal for "for kids, short" checklists; Gemini writes them in about 2 seconds.
- Verified:
  - After a Settings change (Calm, Fast, Instant) and on a fresh load, the editor's Markdown equals the server copy and the address ends at `/create/<id>`.
  - Refreshing mid-writing reopens the same creation, with no duplicate.
  - Stop keeps exactly what's on screen after a reload.
