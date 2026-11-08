# 45 · Landing page: placeholder testimonials (bento cards)

## Goal
Add a testimonials section to the landing page (`/`) as a bento grid of quote cards in the same style as the Features bento. You asked for fake testimonials, so the quotes are **placeholders** to swap for real ones before launch.

## Docs read
- AGENTS.md §3 (responsive 320–1920+), §14 (keep it small).
- prompts/44-landing-page.md (landing structure, Aceternity Bento Grid).

## Code inspected
- `components/aceternity/bento-grid.tsx` (`BentoGrid`: 1 → 2 → 3 columns, dense flow).
- `components/landing/section-intro.tsx`, `app/page.tsx` (section order).
- `components/ui/letter-chip.tsx` (`LetterChip` + space colours) for the avatars.

## Decisions and assumptions
1. **Placement:** between How it works and Pricing, with the anchor `#reviews` (not added to the navbar, which keeps 3 links).
2. **Layout:** `BentoGrid` with 7 cards and mixed spans. One wide "featured" quote (larger text, 2 columns), one tall card, and the rest single. The spans reset on phones (1 column).
3. **Card content:** a quote, a 5-star row (lucide `Star`, filled), an initials avatar (`LetterChip`, no photos, so no faces of real people), a first name plus last initial, a role, and a small "Space" chip showing what they used it for (Biology, Business plan, Cooking…). The quotes describe only real MVP features (summaries, flashcards, quizzes, page links, Create, goal planner).
4. **Clearly marked as placeholder in code:** all quotes live in one array in `components/landing/testimonials.tsx` under a `PLACEHOLDER` comment, so they're easy to find and replace. There's no visible "sample" label on the page, as you asked.
5. **No numbers that claim scale** (no "10,000 users", "4.9 average") because those would be invented stats.
6. A subtle Aceternity `GridBackground` (dot variant) sits behind the section for depth. No new dependencies.

## Files to touch
- `components/landing/testimonials.tsx` (new)
- `app/page.tsx` (insert the section)

## Requirements
- Tokens only. Long quotes and names wrap. No horizontal scroll at 320, 375, 414, 768, 1024, 1280, 1440 or 1920.
- Each quote is a `<figure>` with `<blockquote>` and `<figcaption>`, and the stars have an accessible label ("5 out of 5").

## Security considerations
- Static content only, with no user data and no network calls.
- **Legal note:** fake reviews shown to real visitors as genuine are banned in many places (for example the US FTC rule on fake reviews, and EU consumer law). These must be replaced with real, permitted quotes, or removed, before the site goes live.

## Acceptance criteria
- The section shows 7 bento quote cards between How it works and Pricing.
- At 320px it's one column with no overflow. At 768px it's two columns, and at 1024px+ it's three columns with the featured and tall spans.
- Type check, lint and build pass.

## Checks to run
- `npx tsc --noEmit`, `npm run lint` (changed files), `npm run build`.
- Headless Chrome overflow and screenshot check at all widths.

## Manual test steps
1. `npm run dev`, then open http://localhost:3000 and scroll past How it works.
2. Check the 7 quote cards, the stars, the initials and the Space chips.
3. In DevTools, check 320 → 1920: no sideways scroll, and the cards stack on phones.
