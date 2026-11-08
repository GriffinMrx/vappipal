# 23 — White Vappi pal, smoother and lighter motion

The user wants the pal to be **white**, and its motion to feel **smoother and lighter** (right now it feels a bit stiff and heavy).

## What I checked
- `components/pal/vappi-pal.tsx`:
  - Body: a violet gradient `#a77dff → #5b23b0`.
  - Eyes: their pose is set by React state plus a 180–220 ms CSS transition.
  - Pointer follow: each pointer move sets state, so the 220 ms transition restarts every frame and the eyes judder.
- `app/globals.css` pal keyframes. The motion feels stiff for three reasons:
  - Big moves: hop −14 %, sway ±6°, bounce at 0.5 s alternate.
  - Plain `ease-in-out` on only 2 keyframes.
  - When the mood changes, one body animation is swapped for another, so the body **snaps** back to its rest pose.
- `components/pal/logo-pal.tsx`, plus the chat rows and the welcome screen in `components/chat/course-chat.tsx`.

## Decisions

### Colour (white pal on our dark UI)
- **Body:**
  - Gradient `#ffffff` (top) → `#dcd8e6` (bottom). It's a soft "porcelain" white, so it doesn't glare on `bg`.
  - A faint inner shade at the bottom edge gives it volume.
  - The rim is a light `rgb(0 0 0 / .08)` stroke, so the shape still reads at 24 px.
- **Highlight:** a small white gloss at the top-left (low opacity, because the body is already white).
- **Eyes:** unchanged dark pills `#140a26` with a glint. On white they read even better.
- **Sad:** a cooler grey `#d9dbe3 → #a9adba`, with no violet.
- **Thought dot and sleeping "z":**
  - The thought dot becomes white at 0.7.
  - The "z" uses `fg-muted`, so it reads on the dark background.
- **Ground shadow:** softer (opacity 0.18) and blurred.

### Smoother, lighter motion
1. **Eyes move without React renders.**
   - Pointer follow and glances write to a DOM ref inside one `requestAnimationFrame` loop.
   - Each frame eases toward the target (a critically damped spring: `v += (target-x)*k; v *= damping`). The eyes glide instead of stepping.
   - The loop stops when it settles, so it costs nothing at idle.
2. **Blink:**
   - It closes fast (70 ms) and opens slower (140 ms) with an ease-out. That's the natural shape of a blink.
   - About 1 time in 6 it's a double blink.
3. **Body keyframes are lighter and smoother:**
   - Smaller amplitudes:
     - float −2.5 % over 4 s;
     - hop −8 %, with a gentle squash;
     - sway ±3°;
     - bounce −2.5 % over 1.1 s, as a sine wave instead of `alternate`;
     - breathe ±2 %.
   - Easing: `cubic-bezier(.45,0,.55,1)`, a sine-like curve.
   - Hop and squash use 5 keyframes so there are no corners.
4. **No snapping when the mood changes:**
   - The body gets two nested groups. The outer group keeps the **always-on** gentle float.
   - The inner group gets the mood motion (sway, bounce, hop…). The float never restarts.
   - The inner motion fades in over about 300 ms through a CSS `transition` on the pose. It doesn't jump.
5. **Expression changes ease:** eye shape, tilt and offset use a 260 ms `cubic-bezier(.2,.8,.2,1)` (a soft overshoot-free spring curve) instead of 180 ms.
6. **GPU-friendly:** transforms only, plus `will-change: transform` on the moving groups.
7. **`prefers-reduced-motion`:**
   - As before: no float, sway, bounce or scan, and no pointer-follow loop.
   - Blinks and expression changes stay.

### Unchanged
- The moods, where the pal appears, the logo pal's sleep logic and the store.
- Sizes and layout, so there's no layout shift.

## Files
- **Edit:** `components/pal/vappi-pal.tsx` and the pal keyframes in `app/globals.css`.

## Acceptance criteria
- The pal is white (porcelain) and stays legible at 24, 30 and 96 px on the dark UI. Sad is grey.
- Eyes glide smoothly while following the mouse, with no judder.
- Mood changes (thinking → searching → writing → happy) have no snap or jump.
- The motion is visibly gentler, smaller and slower, but still alive.
- Reduced motion: still, apart from blinks and expressions.
- No horizontal scroll or layout shift from 320 to 1920 px.

## Checks
- tsc, lint, build.
- Headless Chrome:
  - screenshots of every mood at 3 sizes;
  - a frame sequence of a mood change to confirm it doesn't snap;
  - a frame sequence of pointer follow;
  - a reduced-motion emulation.

## Manual test
1. Open a Space's chat. The big white pal says hi, and its eyes glide after your mouse.
2. Ask a question. Watch the pal in the answer row and next to the logo go thinking → searching → writing → happy, smoothly.
3. Turn on "reduce motion" in your OS. The pal stays still but still blinks and changes face.

## Implementation notes (after building)
- **Motion:** all body and eye motion now runs in one `requestAnimationFrame` loop per animated pal. It writes SVG `transform` attributes directly, so there are no React renders per frame.
  - Mood motion amounts blend over about 0.4 s.
  - Hops are a spring impulse (greeting does 2).
  - The eyes use a spring at 0.95 of critical damping, so they settle without bouncing.
  - The old CSS body keyframes (`pal-float` / `hop` / `sway` / `bounce` / `sink` / `breathe` / `scan`) were removed. Only `pal-z` remains.
- **Blink:** 85 ms close, 150 ms open, and a double blink about 1 time in 6.
- **Measured** (headless Chrome, sampling the body transform every frame across 7 mood changes):
  - the biggest per-frame step was ≤ 0.6 units outside hops, which is no snap;
  - during a hop it was about 1.7 units/frame, which is the hop itself;
  - the eyes glide to a new pointer target over about 0.6 s, with no steps;
  - under reduced motion the pose stays identical over time.
- **Colour:** porcelain white `#fff → #f1eff6 → #d6d2e2` with a soft bottom shade and gloss; sad is grey `#d9dbe3 → #a9adba`.
- **Checks:** tsc, lint and build are clean. No horizontal scroll at 375 or 1440 px. The temporary `/pal-preview` page was deleted.
