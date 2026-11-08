# 44 · Landing page (Aceternity UI, bento grid)

## Goal
Replace the temporary public home at `/` with a modern marketing landing page for Vappi, built from Aceternity UI components (https://ui.aceternity.com), with a bento grid at its center. It explains the promise: upload anything, then **Learn** it, **Ask** it, or **Create** from it. It always uses only your own files and always shows the source page. Signed-out visitors get Sign in and Get started. Signed-in visitors get Open Vappi.

There is no design reference image. Per the standing decision ([[mvp-build-decisions]]), I build it from the existing tokens and components (dark theme, Plus Jakarta Sans, purple accent, Vappi pal). It gets replaced exactly when a design arrives.

## Docs read
- AGENTS.md §1 (promise, MVP scope), §3 (responsive 320–1920+, 44px tap targets), §5 (marketing pages are public), §7 (prices from env, **no mock exams on pricing**, everything private), §12 (no user data in analytics).
- Aceternity UI docs: Bento Grid, Spotlight, Background Beams / Grid & Dot backgrounds, Flip Words, Sticky Scroll Reveal, Moving Border, Card Hover Effect. These are copy-paste components (not an npm library). They depend on `motion` (`motion/react`), `clsx`, and `tailwind-merge`.
- `node_modules/next/dist/docs/` on Server and Client Components and `cacheComponents` (Clerk `<Show>` needs a Suspense boundary, as in the current `app/page.tsx`).

## Code inspected
- `app/page.tsx`: the temporary centered logo + Clerk buttons, with `<Show>` in `<Suspense>`.
- `app/globals.css`: tokens (`bg`, `surface`, `border`, `fg*`, `accent-*`, space colors, radii, animations).
- `components/ui/button.tsx` (`buttonClasses`: primary / secondary / accent), `card.tsx`, `badge.tsx`, `pixel-card.tsx`.
- `components/layout/logo.tsx` (Vappi wordmark), `components/pal/vappi-pal.tsx` (moods: greeting, thinking, writing…).
- `components/icons/icon.tsx` + `assets/icons/*` (duotone set: document, bubble-chat, note, planner, checklist, exam, layer, stars, rectagular-upload, file-pdf, file-word, file-image, reminder, crown…).
- `lib/plans.ts`: prices and free limits from env (server-only).
- `proxy.ts`: `/` is public. `package.json`: `clsx` and `tailwind-merge` are present, `motion` is not.

## Decisions and assumptions
1. **New dependency: `motion`** (the package Aceternity components import from `motion/react`). No other UI library. Aceternity code is copied into `components/aceternity/`, adapted to our tokens (no raw hex, our `cn` from `lib/cn`), and trimmed to what we use.
2. **Page sections, in order:**
   1. **Navbar**: an Aceternity *Floating Navbar* style bar (logo, anchor links Features · How it works · Pricing, plus the Clerk buttons). Sticky with a blurred background. On mobile it collapses to the logo, the primary button, and a menu sheet.
   2. **Hero**: the Aceternity *Spotlight* plus a *Grid/Dot background*. Headline "Your AI pal for your own files", with *Flip Words* cycling "Learn it · Ask it · Make something from it". Subline, CTA (accent "Get started free" + secondary "Sign in"), and the **Vappi pal** in the `greeting` mood beside it.
   3. **Bento grid** (Aceternity *Bento Grid*, 3 columns on desktop, mixed spans). Each card has a small live-looking preview built from our own components with clearly sample content:
      - **Learn: summaries** (wide): a short summary with highlighted key terms.
      - **Flashcards**: a flipping card with Again / Hard / Good / Easy chips.
      - **Quizzes**: a multiple-choice question with the correct answer and a "p. 4" source chip.
      - **Ask** (tall): a chat bubble whose answer cites "p. 12, p. 13".
      - **Create** (wide): five type chips (notes, outline, checklist, email, blog post) and a streaming text line.
      - **Goal planner**: a few days to a goal date, with tasks ticked off.
      - **Any file**: PDF, PowerPoint, Word, and photo-of-notes icons, with an "OCR for handwriting" line.
   4. **"Always shows the source"** band: Aceternity *Background Beams*, with the trust message (only your files, every answer cites its pages, private by default).
   5. **How it works**: Aceternity *Sticky Scroll Reveal* with 3 steps (Create a Space and upload → Vappi reads it in about 1–2 minutes → Learn, Ask, Create). On mobile it falls back to a simple stacked list, because sticky scroll is poor on phones.
   6. **Pricing**: three plan cards in the Aceternity *Card Hover Effect* style: Free, Pro (monthly / yearly), and the 30-Day Pass. Prices and free limits are read from `lib/plans.ts` on the server, never hard-coded. Mock exams are **not** listed.
   7. **Final CTA**: a *Moving Border* button, "Start with your first file".
   8. **Footer**: logo, the one-line promise, and © year. No legal links, because no privacy or terms pages exist yet (listed under Needs your attention).
3. **No fake social proof.** No testimonials, user counts, ratings, or company logos (they would be fabricated). Aceternity's *Infinite Moving Cards* is used instead for a marquee of example Space topics (Biology, My business plan, Cooking, Work project…).
4. **Icons**: duotone icons only from the existing `assets/icons` set through `<Icon>`. lucide only for UI glyphs (arrow, menu, check, x). If a card needs an icon we don't have, I leave the slot empty and list the Icoonia name ([[duotone-icons-user-supplied]]).
5. **Server first**: `app/page.tsx` stays a Server Component that reads prices. Only the animated pieces (`Spotlight`, `FlipWords`, `StickyScroll`, `MovingBorder`, `InfiniteMovingCards`, the mobile menu, and the pal) are `"use client"` leaves.
6. **Motion and performance**: every animation respects `prefers-reduced-motion` (static fallback). No images or video, so everything is CSS/SVG. Heavy effects (beams, spotlight) are absolutely positioned with `pointer-events-none` and `overflow-hidden` on the section, so nothing scrolls sideways.
7. **Copy** is plain English, one language, and true to the MVP (Pro unlocks unlimited uploads, chat, Create, and the planner).
8. **Metadata**: the existing title and description stay. I add an `openGraph` title and description for `/` only (no image, since none was supplied).

## Files to touch
- `package.json` / lock: add `motion`.
- `components/aceternity/`: `bento-grid.tsx`, `spotlight.tsx`, `background-beams.tsx`, `grid-background.tsx`, `flip-words.tsx`, `sticky-scroll-reveal.tsx`, `moving-border.tsx`, `card-hover-effect.tsx`, `infinite-moving-cards.tsx`, `floating-navbar.tsx`.
- `components/landing/`: `navbar.tsx`, `hero.tsx`, `features-bento.tsx` (+ small preview pieces), `source-band.tsx`, `how-it-works.tsx`, `pricing.tsx`, `final-cta.tsx`, `footer.tsx`, `auth-buttons.tsx` (Clerk `<Show>` in `<Suspense>`).
- `app/page.tsx`: composes the sections and passes prices and limits from `lib/plans.ts`.
- `app/globals.css`: only the keyframes the Aceternity pieces need (spotlight, marquee, moving border), as tokens.

## Requirements
- Responsive at 320, 375, 414, 768, 1024, 1280, 1440, and 1920, with no horizontal scroll at any width. The bento goes 3 → 2 → 1 columns, and spans reset on mobile. The hero stacks with the pal above or below the text. The pricing cards stack.
- Tap targets are at least 44px. Long words wrap.
- Tokens only (no raw hex in components). Keyboard focus is visible on every link and button. Anchor links scroll smoothly (instantly with reduced motion).
- CTA targets: Get started → Clerk sign-up, Sign in → Clerk sign-in, signed in → `/home`. Pricing buttons send signed-out users to sign-up and signed-in users to `/billing`.

## Security considerations
- A public, static marketing page with no user data, no database reads, and no secrets. Prices come from server env through `lib/plans.ts`, and only numbers reach the client.
- No uploaded material or creations are ever shown. The previews are hard-coded sample text.
- No new analytics events with user content.

## Acceptance criteria
- `/` shows all 8 sections signed out, and the navbar and CTAs switch to "Open Vappi" when signed in.
- The bento grid shows the 7 feature cards with working previews and hover effects.
- Prices match env (default $7/mo, $49/yr, $15 pass), the free limits match `lib/plans.ts`, and mock exams appear nowhere.
- There is no horizontal scroll at any listed width, and reduced motion shows static versions.
- The app pages (`/home` etc.) are unchanged.

## Checks to run
- `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- Dev server: check `/` at every listed width with the browser, plus a reduced-motion check.

## Manual test steps
1. `npm run dev`, then open http://localhost:3000 while signed out.
2. Scroll through every section. Click Features, How it works, and Pricing in the navbar and confirm it scrolls to each one.
3. Click **Get started** to open sign-up, and **Sign in** to open sign-in.
4. Sign in, return to `/`, and confirm the buttons say **Open Vappi** and go to `/home`.
5. In DevTools device mode, check 320, 375, 414, 768, 1024, 1280, 1440, and 1920: no sideways scroll, and the bento, hero, and pricing stack cleanly.
6. DevTools → Rendering → emulate `prefers-reduced-motion: reduce`, then reload. The animations are static.
7. Change `PRICE_PRO_MONTHLY` in `.env`, restart, and confirm the pricing card updates.
