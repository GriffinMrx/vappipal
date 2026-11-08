# 01 — Design system (dark "Opal-style" UI)

## Goal
Build the app's design system from the reference screenshot (Opal "My Library", dark UI): design tokens, the primitive components, and the app shell (sidebar, top bar, page header). Components are named and shaped for **Study From Your Notes** (subjects, documents, flashcards), but they copy the reference's style, spacing, typography, colors, and states exactly. A dev-only showcase page renders every component so the system can be checked on desktop, mobile, and RTL.

No photos are added. Every image slot is a neutral placeholder until the user supplies the assets (listed at the end).

## Docs read
- `AGENTS.md` (sections 3, 5, 6, 7, 11, 12)
- `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md` (Tailwind v4, global CSS)
- `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md` (`next/font/google`, CSS variables)
- Layouts/pages, plus the `cacheComponents` notes (this project has `cacheComponents: true`)

## Code inspected
- `package.json`: Next 16.4.5, React 19.3, Tailwind v4 through `@tailwindcss/turbopack` (no PostCSS config). No UI libraries.
- `next.config.ts`: `cacheComponents`, `partialPrefetching`, Turbopack CSS loader.
- `app/layout.tsx`, `app/page.tsx`, `app/globals.css`: the default create-next-app scaffold (Geist font, light/dark vars).
- `tsconfig.json`: `@/*` maps to the repo root.

## Reference analysis (source of truth)
| Element | Reference | Our version |
|---|---|---|
| App background | near-black `#171717` main, sidebar `#111111` | same tokens |
| Surfaces / cards | `#1B1B1B`, 1px border `#252525`, radius ~12px | `surface`, `border` |
| Text | white headings, body `#BDBDBD`, muted `#707070` | `fg`, `fg-muted`, `fg-subtle` |
| Font | geometric sans (Manrope look), bold page title ~32px | Manrope (Latin) + IBM Plex Sans Arabic (Arabic) |
| Sidebar | logo, workspace switcher, "Menu" nav, "Workspaces" list with letter chips, divider, Upgrade card with white button | logo, **subject switcher**, Menu (Home, Subjects, Planner, Billing, Settings), **Subjects** list with colored letter chips, **Upgrade to Pro** card |
| Nav item | icon + label, active = filled `#1D1D1D` rounded pill | same |
| Top bar | rounded search field, grey "Upload" + "Record" buttons, avatar | search ("Search subjects, documents, flashcards"), **Upload**, **New subject**, avatar (initials) |
| Page header | small uppercase eyebrow "PERSONAL", big title | eyebrow + title (for example "LIBRARY" / "My subjects") |
| Tabs | pill tabs, active = filled `#1D1D1D` | `Tabs` (pill variant) |
| Ghost action | "Create a folder", a subtle filled button with an icon, right aligned | "Create a subject" |
| Section header | icon + title, "See all →" on the right | `SectionHeader` |
| Folder card | name + "N videos" + folder icon at the end | `SubjectCard`: name + "N documents" + exam date dot/color |
| Video card | 16:9 thumbnail, 2-line title, author row, workspace row | `DocumentCard`: 16:9 placeholder with a file-type icon + status badge, 2-line title, page count / time ago, subject row |

## Decisions and assumptions
1. **Dark theme only** for now. The reference is dark, and there is no light reference. Tokens are CSS variables, so a light theme can be added later without touching components.
2. **Tokens** go in `app/globals.css` with Tailwind v4 `@theme`: colors (`bg`, `bg-sidebar`, `surface`, `surface-hover`, `surface-active`, `border`, `fg`, `fg-muted`, `fg-subtle`, `button-secondary`, `danger`, `success`, `warning`, plus 8 subject colors), radii, font families, and a focus ring. Exact hex values are sampled from the screenshot.
3. **Fonts**: Manrope + IBM Plex Sans Arabic through `next/font/google` as CSS variables. Arabic text falls back to Plex Arabic automatically through the font stack.
4. **Icons**:
   - **Duotone icons (provided by you)**: the sidebar nav icons and the feature icons (the ones that look filled/two-tone in the reference). I'll add a `DuotoneIcon` component and a registry at `components/icons/duotone/index.tsx`. Each icon is a React SVG component using `currentColor` for the primary tone and `currentColor` at 40% opacity for the secondary tone. Until you send them, each one temporarily renders the matching **Phosphor** icon with `weight="duotone"` (`@phosphor-icons/react`), so the UI never shows broken boxes. Swapping in your SVGs changes one file.
   - **Non-duotone UI icons** (search, chevrons, arrow, more, close, check, upload arrow): **lucide-react**.
5. **Libraries added**: `lucide-react`, `@phosphor-icons/react` (temporary duotone fallback), `clsx`, and `tailwind-merge` (for a `cn()` helper). No component library.
6. **RTL**: logical classes only (`ms-/me-/ps-/pe-/start-/end-`, `text-start`). Directional icons (arrow, chevron) flip with `rtl:-scale-x-100`. User text uses `dir="auto"`.
7. **Responsive**: the desktop layout matches the reference exactly. Below `lg`, the sidebar becomes an off-canvas drawer opened from a menu button in the top bar. The search field collapses to an icon below `md`. The card grids go 5 → 3 → 2 → 1 columns. Header actions wrap.
8. **Showcase route**: `app/design-system/page.tsx` renders the full "My subjects" screen inside the shell with fake data, plus a component gallery (all variants and states). It calls `notFound()` in production. It is not a product feature, and it gets removed or protected once Clerk lands. A small client toggle switches `dir` between LTR and RTL to test Arabic layout, using sample French, English, and Arabic strings.
9. **No i18n framework yet**. Components take text through props. Real translations come with the i18n prompt.
10. **Toast**: a minimal toast (provider + `useToast`), styled like the cards. Optimistic-UI rollbacks will need it.
11. `app/page.tsx` is left alone apart from removing the scaffold's external links. Real pages come later.

## Files to touch
- `app/globals.css`: tokens, base styles, scrollbar, focus ring
- `app/layout.tsx`: fonts, `dark` colour scheme, metadata title
- `lib/cn.ts`
- `components/icons/duotone/index.tsx`, `components/icons/duotone-icon.tsx`
- `components/ui/`: `button.tsx`, `icon-button.tsx`, `input.tsx`, `search-input.tsx`, `tabs.tsx`, `card.tsx`, `badge.tsx` (incl. `StatusBadge`: Processing / Ready / Failed), `avatar.tsx` (initials only), `letter-chip.tsx`, `select.tsx` (switcher trigger), `dialog.tsx`, `progress.tsx`, `skeleton.tsx`, `empty-state.tsx`, `toast.tsx`, `divider.tsx`
- `components/layout/`: `app-shell.tsx`, `sidebar.tsx`, `nav-item.tsx`, `upgrade-card.tsx`, `topbar.tsx`, `mobile-nav.tsx`, `page-header.tsx`, `section-header.tsx`, `logo.tsx` (text placeholder until the logo arrives)
- `components/study/`: `subject-card.tsx`, `document-card.tsx`
- `app/design-system/page.tsx`, `app/design-system/dir-toggle.tsx`
- `package.json` / lock (the 4 dependencies)

## Requirements
- Every visual value comes from tokens. No raw hex values in components.
- Components are server components by default. Only interactive pieces (`Tabs`, `Dialog`, `Toast`, `MobileNav`, `DirToggle`) are `"use client"`.
- Every interactive element has hover, active, focus-visible, and disabled states that match the reference's subtle-surface style.
- The keyboard works everywhere: the dialog traps focus and closes on Esc, the drawer closes on Esc, and tabs use arrow keys.
- Hit areas are at least 40px on mobile.
- Placeholder image slots (`DocumentCard` thumbnail, logo) are styled boxes. No `<img>` and no external URLs.

## Security considerations
- Pure UI, with no data, secrets, or network calls.
- The showcase uses only fake data and returns 404 in production builds.
- No user content goes to analytics. No user content exists yet.

## Acceptance criteria
- `/design-system` on desktop (1440px+) visually matches the reference layout: sidebar width, top bar, header, tabs, Subjects row, Documents grid, Upgrade card, spacing, and colors.
- At 375px: the drawer sidebar works, the grids are 1–2 columns, nothing overflows horizontally.
- With RTL on: the sidebar sits on the right, text aligns to the start, arrows flip, and the Arabic sample renders in Plex Arabic.
- The gallery shows every component variant and state.
- Type check, lint, and build pass.

## Checks to run
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm run dev`, then inspect `/design-system` at 1440px, 768px, and 375px, in LTR and RTL

## Manual test steps
1. `npm run dev`, then open `http://localhost:3000/design-system`.
2. Compare side by side with the reference at full desktop width.
3. Hover and tab through the nav items, buttons, tabs, and cards, and check that the focus rings are visible.
4. Open the "Create a subject" dialog: Esc closes it and focus returns to the button.
5. Trigger the sample toasts (success and error).
6. In DevTools, set the width to 375px: open and close the drawer, scroll the grids.
7. Click the RTL toggle: check the mirrored layout and the Arabic text.
8. `npm run build && npm start`: `/design-system` returns 404.

## Assets needed from you (not implemented)
- **Logo**: SVG mark + wordmark (light version for the dark UI), and a square mark alone for the collapsed or mobile view.
- **Favicon / app icons**: `favicon.ico`, a 512px PNG icon, an Apple touch icon (180px).
- **Duotone icon set** (SVG, 24px grid, two layers): home, subjects/library, planner/calendar, billing/card, settings, notifications, upload, document (PDF), slides (PPT), word doc, image/photo note, flashcards, quiz, summary, chat, exam/target, folder/subject, sparkle/AI, crown/pro, clock/reminder.
- **Empty-state illustrations** (optional, can be duotone): no subjects, no documents, no cards due, processing failed.
- **Open Graph image** (1200×630) for link previews.
- **Marketing / auth page artwork**: only when those pages are designed.
- Not needed: user photos (avatars use initials) and document thumbnails (file-type icons are used instead).

## Revision (user feedback, 2026-11-05)
- Duotone icons are supplied by the user. All Phosphor stand-ins were removed and `@phosphor-icons/react` was uninstalled. Components now take an optional `icon` / `fileIcon` slot that stays empty until the user adds the icons.
- Only non-duotone icons are implemented, with lucide-react: search, chevrons, arrow, plus, close, menu, trash, info/check/alert, document glyph.
- The logo is now the text wordmark "Vappi". The circle mark was removed. The app metadata title is "Vappi".
