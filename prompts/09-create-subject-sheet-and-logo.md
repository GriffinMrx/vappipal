# 09 — "Create a subject" bottom sheet + new logo

## Goal
1. "Create a subject" opens as a **bottom sheet** that slides up, laid out like the reference ("Create a Workflow Automation" sheet): a grab handle at the top, a centered bold title with a muted subtitle under it, a centered form column with labels above full-width fields, and one full-width white button at the bottom. It replaces the centered modal that opens today.
2. Swap in the user's new logo once they save it over `assets/logo.svg`.

## Docs and code read
- AGENTS.md §2, §3 (match the reference, responsive 320–1920, 44px tap targets), §7 (optimistic create), §13.
- `components/subjects/create-subject-dialog.tsx`: uses `Dialog`, with Name, Exam date (`DatePicker`), and Color fields, plus Cancel and Create in the footer.
- `components/subjects/subjects-provider.tsx`: owns open state, values, errors, the optimistic create, and re-opens with what the student typed if it fails. Unchanged.
- `components/ui/dialog.tsx`: a native `<dialog>` + `showModal()`. Focus trap and Esc come from the browser.
- `components/ui/date-picker.tsx`, `popover.ts`: a native `popover` (top layer), so it already shows above a modal `<dialog>`.
- `components/ui/input.tsx`, `button.tsx` (`primary` = white button), `app/globals.css` (tokens, existing `drawer-in` keyframes).
- `scripts/build-logo.mjs` (`npm run logo`), `components/layout/logo.tsx`, `logo-data.tsx`. Today `logo-data.tsx` matches the current `assets/logo.svg` (I regenerated it and the output was byte-identical), so the new file hasn't been added yet.

## Decisions
- **New `components/ui/sheet.tsx`** (bottom sheet), still a native `<dialog>` with `showModal()`, so focus trap, Esc, the top layer, and the date picker popover all keep working. Pinned to the bottom (`mt-auto mb-0`), full width (`w-full max-w-none`), `rounded-t-card`, `border-t border-border`, `bg-bg-sidebar` (the reference's near-black sheet), backdrop `bg-black/70`, `max-h-[90dvh]` with the body scrolling inside, plus bottom padding for the safe area.
- Opens with a new `sheet-in` keyframe (translateY 100% → 0, 220ms ease-out). Closing is instant, like today's dialog. No new dependency.
- **Grab handle:** a pill `h-1.5 w-12 rounded-pill bg-border-strong`, centered. It's a real `<button aria-label="Close">` with a 44px hit area. Tapping it closes the sheet, and dragging it down more than 80px closes it (pointer events, the sheet follows the finger, snaps back if released early). The reference shows no X or Cancel button, so I'm not adding them. Esc and a backdrop click also close it.
- **Layout from the reference:** title `text-base font-bold text-fg` centered, subtitle `text-xs text-fg-muted` centered, form column `mx-auto w-full max-w-xl` (about 600px, like the reference) with `px-4`, labels above fields (the existing `Input` and `DatePicker` already do this), a `gap-4` stack, then a full-width `Button variant="primary"` labelled **Create**.
- **Fields stay what the data needs:** Name, Exam date, Color. The reference's "Description" field is not added, because subjects have no description in the data model (§8). The copy stays "Create a subject" / "Group the files of one course together."
- `CreateSubjectDialog` keeps its props and file name, so `subjects-provider.tsx` doesn't change. `Dialog` stays as it is for other uses.
- **Mobile:** the sheet is full width at every size, the form column fills it below 600px, and every control is ≥44px tall below `lg`, as today.
- **Logo:** after the user saves the new SVG to `assets/logo.svg`, run `npm run logo`. If the new file isn't a potrace trace (the script expects the full-canvas rectangle with the letters cut out), adapt `build-logo.mjs` so it still outputs one `currentColor` path and a tight viewBox. `Logo` keeps its API, so the sidebar, auth pages, and home update by themselves. No invented graphics.

## Files
- New `components/ui/sheet.tsx`
- Edit `components/subjects/create-subject-dialog.tsx` (use `Sheet`, new layout, full-width Create button)
- Edit `app/globals.css` (add the `--animate-sheet-in` + `sheet-in` keyframes)
- Logo: `components/layout/logo-data.tsx` (generated), and `scripts/build-logo.mjs` only if the new SVG needs it

## Security
UI only. The server action, Zod validation, auth, and optimistic rollback don't change.

## Acceptance criteria
- Clicking any "Create a subject" button slides a bottom sheet up that matches the reference layout (handle, centered title and subtitle, labeled full-width fields, one full-width white button).
- The exam date calendar opens above the sheet and isn't clipped.
- Creating works optimistically as before. If it fails, the sheet re-opens with what the student typed, plus an error toast.
- Tap or drag the handle, Esc, or a backdrop click closes it. Focus goes back to the trigger.
- No horizontal scroll or clipped content at 320, 375, 414, 768, 1024, 1280, 1440, and 1920, or on a landscape phone. A tall form scrolls inside the sheet.
- The new logo shows in the sidebar, the auth pages, and home, with crisp edges and no background box.

## Checks
`npx tsc --noEmit`, `npm run lint`, `npm run build`.

## Manual test
1. Home → "Create a subject" → the sheet slides up from the bottom with the handle, title, fields, and a white Create button.
2. Type a name, pick an exam date (the calendar shows above the sheet), pick a color → Create → the sheet closes, the subject appears at once, and the success toast shows.
3. Go offline in DevTools → create again → the subject disappears, the error toast shows, and the sheet re-opens with your text.
4. Open the sheet → close it each way: tap the handle, drag the handle down, Esc, and a backdrop click.
5. Repeat step 1 at every width above and on a landscape phone.
6. After you replace `assets/logo.svg`: the sidebar, sign-in, and home show the new logo.
