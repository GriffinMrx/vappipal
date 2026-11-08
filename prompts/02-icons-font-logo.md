# 02 — Duotone icons, Plus Jakarta Sans, Vappi logo

## Goal
1. Wire up the duotone icons the user exported to `assets/icons/` (Icoonia Pro, Duo Tone Style) in every icon slot of the design system.
2. Switch the app font from Manrope to **Plus Jakarta Sans**.
3. Build the **Vappi** wordmark logo in the style of the reference ("Slide" wordmark: heavy, rounded, soft monoline letters with round ends), using the app's own colors (white `fg`), not the reference's lavender.

## Docs read
- `AGENTS.md` (sections 2, 3, 7, 12)
- `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md` (`next/font/google`, CSS variables)
- Prompt `01-design-system.md` and its revision (duotone icons are user-supplied; no placeholders)

## Code / assets inspected
- `assets/icons/*.svg`: 22 files. 24×24 (crown and reminder are 22×22). Pure `fill="black"`, with one base layer and one secondary layer at `opacity 0.4` (one file uses 0.3). A few use `stroke="black"`.
- `components/layout/logo.tsx` (text placeholder), `app/layout.tsx` (Manrope + IBM Plex Sans Arabic), all components with empty `icon` slots from prompt 01.

## Decisions
1. **Icon pipeline**: the SVGs stay in `assets/icons/` as the source. A small Node script, `scripts/build-icons.mjs` (run with `npm run icons`), turns each file into a typed React component in `components/icons/generated.tsx`. The script replaces `black` with `currentColor`, keeps the opacity layers, keeps each file's own viewBox, and strips the fixed width/height. Icons then follow the text color and can be resized. This works on the server, so no client JS is needed.
2. **Icon API**: `<Icon name="home" size={20} />`, where `name` is the file name (kebab-case). It is decorative by default (`aria-hidden`), with an optional `label`.
3. **Slot mapping** (file → where it's used):
   | File | Used in |
   |---|---|
   | `home` | Sidebar → Home |
   | `folder-library` | Sidebar → Subjects |
   | `planner` | Sidebar → Planner |
   | `credit-card` | Sidebar → Billing |
   | `setting` | Sidebar → Settings |
   | `rectagular-upload` | Top bar Upload button (desktop + mobile) |
   | `folder` | "Create a subject" button, Subjects section header, SubjectCard |
   | `document` | Documents section header |
   | `file-pdf` / `file-word` / `file-image` | DocumentCard thumbnail by file type |
   | `layer` | Flashcards (tab + "no cards due" empty state) |
   | `checklist` | Quiz tab |
   | `note` | Summary tab |
   | `bubble-chat-alert` | Chat tab / "notes don't contain the answer" state |
   | `bubble-chat-delete` | Clear chat action (showcase only for now) |
   | `exam` | Exam date (subject card meta, dialog) |
   | `stars` | AI-generated label |
   | `crown` | Upgrade to Pro card, Pro badge |
   | `reminder` | Daily reminder (settings, showcase) |
   | `bold-download` | Download / open original file |
   | `two-slider-vertical` | Filter / sort button |
4. **Missing icons**: `notifications` (`alarm`) and `slides` (`file-powerpoint`) were not exported. PowerPoint cards fall back to the `document` icon until `file-powerpoint.svg` is added. No notifications icon is shown yet.
5. **Font**: Plus Jakarta Sans through `next/font/google` (`latin`, `latin-ext`) as `--font-jakarta`, replacing Manrope in `--font-sans`. Arabic still falls back to IBM Plex Sans Arabic, because Jakarta has no Arabic glyphs.
6. **Logo**: a hand-built inline SVG wordmark "Vappi" in `components/layout/logo.tsx`. It uses thick rounded strokes with round caps and joins, and soft bowls on a/p/p, matching the reference's chunky, friendly, rounded geometry. It is single color, `currentColor`, so it renders `fg` (white) on the dark UI. It has `role="img"` and `aria-label="Vappi"`. The same file exports a compact mark ("V") for tight spaces. The word is drawn as vector shapes, not typed text, so it looks the same in RTL and does not depend on any font.
7. Delete nothing in `assets/icons/`. The generated file is committed, and running the script again is idempotent.

## Files to touch
- `scripts/build-icons.mjs` (new), `package.json` (`"icons"` script)
- `components/icons/generated.tsx` (generated), `components/icons/icon.tsx` (new)
- `components/layout/logo.tsx`, `app/layout.tsx`, `app/globals.css`
- `app/design-system/page.tsx`, `app/design-system/interactive-demos.tsx` (pass icons into the slots, add an icon gallery and a logo preview)
- `components/study/document-card.tsx` (the showcase passes the file icon; the component API is unchanged)

## Security
UI only. The SVGs are local files, converted at dev time. No user content and no network calls.

## Acceptance criteria
- Every slot from prompt 01 shows the matching duotone icon in the theme color. The secondary layer shows at about 40%, like the reference's sidebar icons.
- All text renders in Plus Jakarta Sans. Arabic samples render in IBM Plex Sans Arabic.
- The "Vappi" wordmark sits in the sidebar header in the reference's position and size. It is chunky and rounded like the "Slide" sample, and white.
- Desktop, 375px, and RTL views have no regressions.
- `tsc`, lint, and build pass.

## Checks
`npm run icons`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, plus screenshots of `/design-system` at 1906px, at 375px, and in RTL.

## Manual test
1. Open `/design-system`: the sidebar icons, Upload, section headers, cards, and empty state all show duotone icons.
2. Hover a nav item: the icon color follows the text color.
3. Check the logo against the "Slide" reference: weight, roundness, proportions.
4. Click RTL: the icons and logo are unchanged and the layout mirrors.
5. Add a new SVG to `assets/icons/`, run `npm run icons`: the name becomes available to `<Icon name=…>`.
