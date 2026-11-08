# 46 · Landing bento grids: match the reference style

## Goal
Restyle the landing page's Features bento to match the reference image you sent (Aceternity's "Post to multiple platforms / Analytics / Integrated AI / Easy Collaboration / Know your audience" bento), using Vappi's features. Then apply the same card shell to the Reviews bento so the two match.

## Reference analysis (source of truth)
| Element | Reference | Our version |
|---|---|---|
| Grid | 3 columns. Row 1: wide (2) + 1. Row 2: 1 + 1 + 1. Equal row heights (about 18 to 19rem), 1rem gap | same: **5 cards** |
| Card shell | `rounded-xl`, 1px `white/10` border, `rgba(40,40,40,0.3)` fill, inset glow `shadow-[2px_4px_16px_0px_rgba(248,248,248,0.06)_inset]`, `p-8` (from the Aceternity blog code) | same values, exposed as tokens in `globals.css` |
| Text | Title `text-lg font-semibold` white. Description `text-sm` neutral-400, `max-w-sm`. **At the top** in the wide card, **at the bottom** in the small cards | same |
| Wide card visual | two offset rows of glassy rounded icon tiles (platform logos), faded at the edges, with thin connector lines into the tiles | **Upload anything**: glassy tiles with file icons (PDF, PPTX, DOCX, photo, notes) and thin connector lines |
| Analytics card | a curve line with a white dot, a pill label ("+200 connections"), a blue cursor, and a faint vertical guide | **Goal planner**: a progress curve to a goal, a pill "6 days to your exam", a dot, a cursor, a guide line |
| Integrated AI | a row of circular glass icons, with the centre one large (OpenAI logo) and the side ones fading out | **Learn**: the centre circle is the Vappi pal, with side circles for summary, flashcards and quiz icons, fading outward |
| Collaboration | a dot row on top, a faint column grid, stacked labelled chips ("Twitter post", "Email Campaign"), and blue cursors with names | **Create**: chips "Notes", "Email", "Outline" (plus the dot row and grid), with cursors labelled "You" and "Vappi" |
| Know your audience | a glass avatar tile, a name, a stat ("Most engagements • 69,420"), and a wavy line chart | **Ask**: a glass tile with the Vappi pal, "Vappi", a stat "Cited pages • 12, 13", and a wavy line |

## Decisions and assumptions
1. **5 cards, as in the reference** (down from 7). Summaries, flashcards and quizzes merge into the **Learn** card ("Summaries, flashcards and quizzes from your files"), with icons in its circles. The detailed previews in `previews.tsx` used by the bento are removed. The How it works previews stay.
2. **Brand logos are replaced** by our file icons (`file-pdf`, `file-word`, `file-image`, `document`, `note`), and the OpenAI logo by the Vappi pal. No third-party logos. PPTX shows a text label, because there's still no PowerPoint icon.
3. **Cursors:** a lucide `MousePointer2`, filled with the `space-blue` token, as in the reference.
4. **Motion (subtle):** a light runs along the upload connector lines, and the cursors drift slightly on card hover. Both are CSS only and stop with reduced motion.
5. The **card shell** becomes a reusable `bento-card` style used by both the Features and Reviews grids. The Reviews layout and content stay the same. Only the border, fill and glow change, and the featured purple card keeps its accent.
6. The colours in the reference (`white/10`, `rgba(40,40,40,.3)`, neutral-400) are added as tokens (`--color-bento-border`, `--color-bento-fill`, `--color-bento-glow`), so components stay token-only.

## Docs read
- Aceternity blog, "How to create a bento grid with Tailwind CSS, Next.js and Framer Motion" (card shell, title and description classes, grid spans).
- AGENTS.md §3 (match the reference exactly, responsive 320–1920+).

## Code inspected
- `components/aceternity/bento-grid.tsx`, `components/landing/features-bento.tsx`, `previews.tsx`, `testimonials.tsx`, `app/globals.css`.

## Files to touch
- `app/globals.css` (bento tokens, the connector light keyframes)
- `components/aceternity/bento-grid.tsx` (reference card shell, `text` position top or bottom)
- `components/landing/bento-visuals.tsx` (new: UploadTiles, GoalCurve, LearnOrbs, CreateBoard, AskProfile)
- `components/landing/features-bento.tsx` (5 cards)
- `components/landing/previews.tsx` (remove the unused bento previews)
- `components/landing/testimonials.tsx` (use the shell)

## Responsive
- Desktop (1024+): matches the reference exactly. Tablet (768): wide cards span 2 columns, and the three small cards are 2 + 1 (the last spans 2). Phones: 1 column, the visuals scale down, the tile rows are clipped and faded at the edges (never scrolling), and text sits under each visual.

## Security
- Static content only. No user data.

## Acceptance criteria
- At 1440, the Features bento visually matches the reference: layout, card shell, text placement, and the five visual types.
- No horizontal scroll at 320, 375, 414, 768, 1024, 1280, 1440 or 1920. Reduced motion shows everything still.
- Reviews cards use the same shell. Type check, lint and build pass.

## Manual test steps
1. Open http://localhost:3000/#features and compare with the reference image side by side.
2. Hover each card: the cursors drift and the light runs along the connector lines.
3. Check 320 → 1920 in DevTools, then with reduced motion on.
