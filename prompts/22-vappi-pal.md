# 22 — "Vappi pal": an animated AI character that reacts

The user wants an AI pal "with animations, everything" for the app. It replaces the sparkle avatar next to "Vappi" in the chat (their screenshot), reacts to what the AI is doing, and also sits next to the logo. Their reference is the Bible Strong Avatar Lab (https://avatars.bible-strong.app/).

## What I checked
- **The reference** (headless Chrome screenshot): procedural 2D characters. A soft coloured blob ("Strobi") with two dark pill-shaped eyes; expressions change the eye shape and angle; it has gentle ambient motion, randomized blinking (first blink at 2.1 s, then every 2.8–5 s, 260 ms long), head tilt, and loop/once/ping-pong animations built from expression steps.
- **License:** the studio repo (`smontlouis/bible-strong-avatar-lab`) **and** its runtime packages on npm (`@bible-strong/avatar-react`, `@bible-strong/avatar-core`) are **AGPL-3.0-only**. Using that code in Vappi (a hosted SaaS) would oblige us to publish Vappi's full source to its users. **Decision: none of their code or exports is used.** The pal is our own original SVG + CSS implementation of the same simple style (a blob with pill eyes is a generic look), in Vappi's colours.
- **Code:**
  - `components/chat/course-chat.tsx` (`AssistantRow` sparkle avatar, the live phases waiting/search/write, the error card, `Welcome`)
  - `components/layout/sidebar.tsx` + `logo.tsx`
  - `app/globals.css` (keyframes, reduced-motion pattern)
  - `components/chat/ai-typing-indicator.tsx`

## Decisions

### The character (`components/pal/vappi-pal.tsx`, client, SVG)
- **Body:** a rounded blob (soft superellipse) filled with our accent gradient (`accent-bottom` → a lighter violet), a soft top-left highlight and a faint rim, like our accent keys.
- **Eyes:** two dark pills (`#140a26`), each with a tiny light glint. Every expression is just an eye shape (scale, angle, offset) plus a body motion, so it stays light.
- **Moods** (`mood` prop):

  | Mood | When | Eyes | Body |
  |---|---|---|---|
  | `idle` | default | neutral; random blink 2.8–5 s; looks around now and then | slow float |
  | `greeting` | first open / empty chat | happy `^ ^` | a little hop + squash |
  | `thinking` | waiting for the server | look up-right, one slightly squinted | slow tilt sway |
  | `searching` | "Searching your notes" | scan left ↔ right | slight lean |
  | `writing` | answer streaming | focused (flatter), look down | soft quick bounce |
  | `happy` | answer done (1.6 s, then idle) | `^ ^` arcs | hop |
  | `sad` | an error | droop, tilted inward | sinks, slightly desaturated |
  | `sleeping` | chat closed / nothing happening for 60 s (logo pal only) | closed lines | slow breathing + tiny "z" |

- **Eyes follow the pointer** (the big welcome pal and the logo pal on hover), with a few px of max offset and smoothed.
- **Sizes:** `size` in px (24 logo, 28 chat rows, 88 welcome). It scales cleanly as SVG.
- **Accessibility:** `role="img"` with a label ("Vappi, thinking"), decorative where text already says the same. **`prefers-reduced-motion`**: no float, bounce or scan; expressions change instantly; blinking still allowed (it's a tiny change). Animations are CSS transforms only, with no per-frame React renders (blink and look use timers).

### Where it appears
1. **Chat assistant rows:** the pal replaces the sparkle avatar.
   - The live answer row shows the pal reacting: `thinking` → `searching` → `writing` → `happy`.
   - Past answers show a calm `idle` pal, static (no float), so a long chat isn't a crowd of moving blobs. Only the newest answer's pal is animated.
   - The inline "Couldn't answer" card shows a `sad` pal.
2. **Chat welcome (empty chat):** a big pal doing `greeting`, then `idle` with eyes following the pointer, above "Ask anything about {subject}".
3. **Next to the logo** in the sidebar (and the mobile header): a small pal that **mirrors the AI's state anywhere in the app**. It thinks, searches and writes while a chat answer is running, and is happy for a moment when it's done. Otherwise it's idle, and after 60 s it falls asleep (wakes on hover).
   - A tiny client store (`components/pal/pal-store.ts`, `useSyncExternalStore`) holds the current mood. The chat publishes to it.
   - The logo stays a link to Home, and the pal is decorative there.

### Not included
No sound, no photo/export, no avatar editor. Only one character, Vappi's.

## Files
- **New:** `components/pal/vappi-pal.tsx`, `components/pal/pal-store.ts`, `components/pal/logo-pal.tsx`.
- **Edit:** `app/globals.css` (pal keyframes), `components/chat/course-chat.tsx`, `components/layout/sidebar.tsx` (or wherever the logo renders), `components/layout/mobile-nav.tsx`/`topbar.tsx` if the logo shows there.

## Acceptance criteria
- The chat avatar is the pal. During an answer it visibly goes thinking → searching → writing → happy. Errors show it sad. "hi" goes greeting/happy without the search look.
- The welcome pal greets, blinks and follows the pointer.
- The logo pal mirrors the chat's state while an answer runs, idles otherwise, and sleeps after 60 s.
- With reduced motion, nothing moves except blinks, and moods still change.
- It stays crisp at every size, with no layout shift and no horizontal scroll; 320–1920 is unaffected.
- No AGPL code or assets in the repo.

## Checks
- `tsc`, lint, build.
- Headless Chrome screenshots of each mood (a small test page isn't added to the app; the moods are captured by driving the real chat).
- A reduced-motion emulation screenshot.

## Manual test
1. Open a subject → chat. The big pal says hi and its eyes follow your mouse.
2. Ask a question and watch the pal in the answer row and next to the logo: thinking → searching → writing → happy.
3. Go offline mid-answer → the error card shows a sad pal.
4. Leave the app idle for a minute → the logo pal falls asleep, and hovering wakes it.

## Implementation notes (after building)
- **Files:** `components/pal/vappi-pal.tsx` (SVG + CSS, 8 moods), `pal-store.ts` (external store with a version counter), `logo-pal.tsx`; the `pal-*` keyframes are in `globals.css`.
- **Fixed while testing:**
  - **The waiting state never showed.** The first `setLive()` ran inside the async `startTransition`, so React held it until the whole send finished. The pal skipped "thinking", and the typing dots never appeared during the ~3 s intent check. It's now set before the transition.
  - **"Searching" flashed by unseen.** The server's `search` and `found` events often arrive in one chunk. The search start is now recorded from the event, and the pal holds "searching" for at least 0.7 s.
  - **The logo pal fell straight back asleep** after AI activity. Its sleep is now tied to the store version.
- **Measured on the logo pal during a real answer:** thinking (sway + thought dot) at once → searching (eye scan) → writing (bounce, on longer answers) → happy (hop) → idle.
- **Screenshots:** all 8 moods at 28/48/120 px (a temporary `/pal-preview` page, deleted afterwards), plus the chat panel and the logo.
- **Icons:** the user uploaded `bubble-chat` and `add-event` (the calendar). They replace the two temporary line icons in the plan cards.
- No AGPL code from the reference was used. The test chat messages were deleted afterwards.
