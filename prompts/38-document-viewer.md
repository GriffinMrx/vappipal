# 38 · Read your files inside Vappi (viewer for every upload type)

(Inserted before the email series: emails become 39 Files ready, 40 Goal coming up, 41 Plan ending soon.)

## Goal
Every uploaded file opens inside the app, in a viewer, instead of a raw download or a browser tab:
- PDF
- PowerPoint
- Word
- photos

Every "page X" link Vappi shows opens the viewer **at that page or slide**, with the cited page highlighted for a moment. That covers chat citations, flashcard and quiz sources, summaries, creations' sources, and the Files list. The user chose "Original look" for Word and PowerPoint.

## What I inspected
- `app/(app)/spaces/[spaceId]/documents/[documentId]/file/route.ts`: owner check → 5-minute signed storage URL (302). Kept as the byte source.
- The links that open files today:
  - `components/chat/answer-text.tsx` (`sourceHref`)
  - `components/study/source-link.tsx`
  - `components/study/summary-view.tsx`
  - `components/documents/document-list.tsx`

  All of them use a new tab and only PDFs get `#page`.
- `lib/extract/office.ts`, which defines the page numbers we cite:
  - **PowerPoint:** one page per slide.
  - **Word:** Word's saved page breaks; without any, about 500 words a page.
- `scripts/storage-cors.mjs`: browser GET is already allowed on the bucket, so the viewer can read the file directly.
- `components/chat/chat-panel.tsx`: the chat panel is mounted per page, so the viewer can have it too.

## Decisions
1. **New page** `/spaces/[spaceId]/documents/[documentId]?page=N`:
   - A server component checks that the document is the user's and in that Space, otherwise 404.
   - It renders a client `DocumentViewer`, inside `ChatPanelLayout`, so the chat can stay open beside the file. Ask → click a page → read it next to the answer.
2. **Toolbar:**
   - Back (to the Space Files tab, or the previous page).
   - The file name.
   - "Page/Slide N of M" with a number box to jump.
   - Zoom − / + and "Fit width".
   - "Download original" (the existing `/file` route).

   It's sticky and wraps at 320 px.
3. **By file type:**

   | Type | How it's shown | Jump to a cited page |
   |---|---|---|
   | **PDF** | `pdfjs-dist` (added as a direct dependency, same version 5.4 already installed) renders each page to a canvas plus a **text layer**, so text can be selected and copied. Pages render lazily as you scroll; nearby pages are kept. | page N |
   | **Word** | `docx-preview` (Apache-2.0) renders fonts, headings, lists, tables and images, splitting at the same page breaks we cite (`breakPages`, keep Word's rendered breaks). | Nth page; if the file has no page breaks, the matching position in the text |
   | **PowerPoint** | `pptx-preview` (ISC) draws each slide at 16:9 and scales it to the width | slide N |
   | **Photo** | the image, fitted, with zoom | — |

   - The PowerPoint renderer is close, but not pixel-perfect, so "Download original" is always there.
   - The Word and PowerPoint libraries are loaded only when such a file is opened (dynamic import), so other pages stay light.
   - On the PowerPoint fallback text: if a slide can't be drawn, its extracted text shows instead of a blank. This keeps the chosen Original look as the default; the text is only a fallback.
4. **Cited page:** it scrolls into view with a short accent ring (1.6 s). The page number in the address updates as you scroll, so Back and refresh return to the same page.
5. **Links:** every place above now opens the viewer **in the same tab**, at `?page=N` (and for any file type, not just PDF). The old `/file` route stays for downloads.
6. **States:**
   - Loading: a skeleton for each page.
   - A Processing or Failed file still opens, since its original bytes exist.
   - If a file can't be drawn: "Can't show this file here", plus Download.
7. **Security:**
   - Same owner check as today.
   - Bytes come only from 5-minute signed URLs; nothing is public, and nothing is sent to an outside viewer.
   - No file names in logs.
8. **Responsive:**
   - Pages are fit to the width by default.
   - At 320 px the toolbar wraps.
   - No sideways scroll except inside a zoomed page, which pans within its own box.

## Files
- New:
  - `app/(app)/spaces/[spaceId]/documents/[documentId]/page.tsx`
  - `components/viewer/document-viewer.tsx` (toolbar, page state)
  - `components/viewer/pdf-view.tsx`, `docx-view.tsx`, `pptx-view.tsx`, `image-view.tsx`
  - `lib/documents/viewer.ts` (link helper)
- Changed: the four link places above, and `package.json` (`pdfjs-dist`, `docx-preview`, `pptx-preview`).

## Acceptance
1. A real PDF opens in the app.
   - A chat citation "p. 7" opens at page 7, highlighted.
   - The text is selectable.
   - Zoom and Fit work.
   - Scrolling updates "Page N".
2. Real Word and PowerPoint files are uploaded, processed, and opened:
   - They show their original formatting.
   - A source link to page or slide N lands there.
3. A photo opens and zooms.
4. Other users' document URLs return 404; signed out gets sign-in.
5. 320–1920 px: no page-level sideways scroll, and the toolbar is usable.
6. The chat beside the viewer works.
7. tsc, lint, build; test files cleaned up.

## Implementation notes
- **Fetching the file:**
  - The `/file` route now also answers `?signed=1` with `{ url }`; the viewer fetches that signed URL directly.
  - A plain fetch through our 302 reaches storage with `Origin: null` (a cross-site redirect taints the origin), which the bucket's CORS rules refuse.
  - Download still uses the 302.
- **Jumping to a page:**
  - Done with measured `window.scrollTo`, below the app top bar and the viewer toolbar (both sticky). `scrollIntoView` misplaced CSS-zoomed Word pages.
  - Page tracking ignores scroll events for 0.9 s after a jump, so the requested page stays in the box and the address.
- **New `loading.tsx`** for the viewer route (cacheComponents needs a boundary there).
- **pptx-preview:**
  - Draws decks made from PowerPoint's own template (python-pptx test deck).
  - Parses **0 slides** from files written by pptxgenjs. For any Word or PowerPoint file it can't draw, the viewer shows the **text Vappi read**, page by page (rebuilt from the stored chunks with the 150-character overlap removed), so jumps still work.
  - The npm package is free for commercial use, but its source isn't open; noted for the user.
- **Not a bug, a test artifact:** test uploads first failed with storage 403 because the headless test browser sent its Clerk `Authorization` header to storage too. Real browsers don't; tests now send it only to localhost.
- **Verified:**

  | Case | Result |
  |---|---|
  | PDF `?page=7` | lands on page 7 with the ring; text layer selectable ("Several weeks passed with…") |
  | Scrolling | box and address follow (2 → 5) |
  | Typing a page number | page 20 lands under the bars |
  | Zoom 150% | pans inside its box; no page-level sideways scroll |
  | Word | page 3 |
  | Template PowerPoint deck | slide 4 |
  | pptxgenjs deck | text fallback |
  | Photo | fits the width |
  | Widths | 320 and 1280 px fine |
  | Chat citation "p. 3 Volcanoes.docx" | same tab → viewer at page 3, chat still open |
  | Another user's file | not-found page, and its signed URL 404 |
  | Signed out | redirected to sign-in |

- **Clean-up:** the test Space, its 4 uploaded files and the chat rows were deleted.
