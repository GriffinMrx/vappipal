# 08 — Custom subject switcher and date picker

## Goal
The sidebar "Open a subject…" switcher (native `<select>`) and the "Exam date" field (native `<input type="date">`) open the browser's own popups, which look out of place on the dark Vappi UI. Replace both with custom dropdowns that match the design system: dark surface, hairline border, rounded corners, smooth open animation.

## Docs and code read
- AGENTS.md §2, §3 (responsive, 44px tap targets), §13 (testing).
- `components/layout/sidebar.tsx` (`SidebarSwitcher`, native select + `ChevronsUpDown`).
- `components/subjects/subject-views.tsx` (`SubjectSwitcher`, uses `router.push`).
- `components/subjects/create-subject-dialog.tsx` (exam date `Input type="date"` with `min`).
- `components/ui/input.tsx`, `components/ui/dialog.tsx` (native modal `<dialog>`, which clips/scrolls overflow), `app/globals.css` tokens + `animate-fade-in`.

## Decisions
- No new dependency. Built with React + the native HTML `popover` attribute (top layer), so the menus render above the modal dialog and the sidebar without being clipped. Position is computed from the trigger's rect (`position: fixed`), flipped above when there is no room below, clamped to the viewport, and closed on scroll/resize.
- **SubjectSelect (switcher):** trigger keeps today's look (hairline border, dim text, `ChevronsUpDown`, `h-11 lg:h-10`). Menu: `bg-surface`, `border-border`, `rounded-card`, shadow, `animate-fade-in`; each option shows the gray letter chip + name (same as the sidebar list), check mark on the current one, hover/active `bg-surface-hover`, `min-h-11 lg:min-h-9`. Max height with scroll; long names wrap. Keyboard: Up/Down, Home/End, Enter/Space, Esc, Tab closes. ARIA: `button[aria-haspopup=listbox][aria-expanded]` + `role=listbox`/`option`/`aria-selected`/`aria-activedescendant`.
- **DatePicker (exam date):** trigger styled like `Input` (same classes, label/hint/error), shows "12 Dec 2026" or placeholder "Pick a date", lucide `CalendarDays` icon (non-duotone), plus a clear (×) button when set (the field is optional). Popover: month header with prev/next buttons, Mon–Sun week grid, today ringed, selected filled white (primary), days before `min` disabled. Keyboard: arrows move by day/week, PageUp/PageDown by month, Enter selects, Esc closes. Value stays a `YYYY-MM-DD` string, so the form/action/validation code does not change. Dates computed in UTC on day strings (no server-time issues).
- Day cells `size-10` desktop, `size-11` on touch (grid fits 7×44 = 308px; popover width `min(20rem, 100vw - 1rem)`).

## Files
- New `components/ui/popover.ts` (shared `usePopover` hook: open/close, positioning, outside click, scroll/resize close).
- New `components/ui/select-menu.tsx` (generic listbox) — used by `SidebarSwitcher`.
- New `components/ui/date-picker.tsx`.
- Edit `components/layout/sidebar.tsx` (`SidebarSwitcher` → custom), `components/subjects/subject-views.tsx` (pass `onSelect`), `components/subjects/create-subject-dialog.tsx` (use `DatePicker`).

## Security
UI only. No data, server, or auth change.

## Acceptance criteria
- Neither control opens a browser-native popup in Chrome or Firefox.
- Menus match the dark design, animate in, and never overflow the screen at 320–1920 or in landscape; inside the dialog the calendar sits above the dialog, not clipped.
- Selecting a subject navigates; selecting a date fills the field; past dates can't be picked; clearing works; server validation still rejects a past date.
- Tap targets ≥44px below `lg`. Keyboard and screen-reader roles work. Desktop trigger look unchanged.

## Checks
`npx tsc --noEmit`, `npm run lint`, `npm run build`.

## Manual test
1. Sidebar → click "Open a subject…" → dark menu with chips opens; pick a subject → its page opens and the trigger shows its name.
2. Keyboard: focus the switcher, press Down, arrow, Enter → navigates. Esc closes.
3. Home → Create a subject → Exam date → calendar opens above the dialog; go next month, pick a day → field shows it; × clears it; yesterday is disabled.
4. Create with a date → subject shows "Exam …" with that date.
5. Repeat 1 and 3 at 320, 375, 414, 768, 1024, 1280, 1440, 1920 and a landscape phone: no overflow, everything tappable.

## Implementation notes
- Clear and Today sit in the calendar footer instead of an x in the field (simpler, and the targets are always 44px on touch).
- When the calendar fits neither below nor above the field (for example 320x640), it shifts up to stay fully on screen. On very short landscape phones it scrolls inside itself.
- Results: tsc, lint and build pass. Browser test: 41/41 pass.
