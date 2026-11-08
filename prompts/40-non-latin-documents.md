# 40 · Non-Latin documents get no summary, flashcards or quiz

## Goal
Arabic (and any non-Latin script: Russian, Greek, Hindi, Chinese…) files must get a summary, flashcards and a quiz like English files. When a file truly has too little text, the Summary tab must say so instead of offering a button that silently does nothing.

## What the user saw
Arabic PDF `قصة سيدنا آدم.pdf` (10 pages) is Ready, but Summary shows "No summary for this document yet". Clicking "Write summary" does nothing, and uploading again does the same. Flashcards and Quiz are empty too.

## What I found (database + Inngest dev server)
- The Inngest runs all COMPLETE. Each step is `DONE` with the error "Not enough text to make learning material from this file." No AI call is ever made.
- **Root cause, every non-Latin file:** `lib/jobs/study-material.ts` requires at least 3 sentences from `splitSentences()` (`lib/ai/text.ts`). That function:
  - keeps only sentences containing a Latin letter (`/[a-z]/i`), so Arabic gives 0;
  - splits only before a capital letter `[A-Z0-9"“(]`. Arabic, Chinese and others have no capitals, so a page becomes one "sentence" over 400 characters and is dropped.
- **Second cause, this PDF:** its text layer stores Arabic as presentation-form glyphs (U+FB50–FDFF, U+FE70–FEFF) in visual (reversed) order. pdf-parse returns e.g. `ﻒﻴﻟﺄﺗ ﻦﻣ ﺔﺼﻗ` for "قصة من تأليف". It isn't empty, so the page is never sent to OCR, and the AI would get unreadable text.
- **UI:** the Summary empty state never shows the step's message, so the user can't tell why nothing happened.
- `splitSentences` is also used by the mock AI and by chat (`lib/chat/answer.ts`, first sentence of an excerpt). Both benefit; English behavior is unchanged.

## Changes
1. `lib/ai/text.ts` `splitSentences`:
   - letter test `\p{L}` (any script) instead of `[a-z]`;
   - also split after `؟ ۔ 。 ！ ？` (with or without a following space), and after `. ! ?` + space when the next character is a non-ASCII letter (Arabic, Cyrillic…). The English rule (split before capital/digit/quote) is unchanged.
2. `lib/jobs/study-material.ts` gate: also pass when the document has at least 200 letters (`\p{L}`) in total, so text with little punctuation isn't refused. It can only become less strict, never more.
3. `lib/extract/pdf.ts`: if 30% or more of a page's letters are Arabic presentation forms, mark the page `needsOcr` (Gemini OCR reads the rendered page in proper order). The page text is also NFKC-normalised (presentation forms → normal Arabic letters) as the fallback.
4. `lib/extract/index.ts` `withOcr`: if OCR returns only the "[OCR preview]" placeholder (mock provider or the page couldn't be rendered) and the page already had real text, keep that text instead of the placeholder. Truly scanned pages (under 20 characters) behave as before.
5. `lib/study/queries.ts` + `components/study/summary-view.tsx`: pass the summary step's message. When it is "Not enough text…", the empty state shows that sentence under the file name. The button stays (the user can still retry).

## Existing file
Its stored chunks are already the garbled text, and "Write summary" re-uses chunks, so the fix needs a re-extract. After the change: delete that PDF and upload it again.

## Security
No change to auth or scoping. OCR stays server-side in the Inngest job; document text stays untrusted input to the AI.

## Checks
- `tsc`, `eslint`, `next build`.
- Unit check in Node: `splitSentences` on English (same output as before), Arabic, Russian and Chinese samples.
- Run the PDF extractor on the user's Arabic PDF from storage: pages are flagged for OCR, and the OCR'd text reads correctly.
- End to end: re-upload the Arabic PDF → Ready with a summary, flashcards and quiz with real page numbers. Re-check an English PDF.

## Manual test
1. Delete `قصة سيدنا آدم.pdf` in the Space, upload it again, and wait for Ready.
2. Learn → Summary: an Arabic summary. Flashcards → Arabic cards. Quiz → Arabic questions, each with a page link.
3. Upload an English PDF: works as before.

## Outcome (implementation notes)
- Also done, at the user's request ("let the AI speak according to the subject language"): the study prompts now say "never translate"; chat answers in the user's language, or the files' language when the message shows none (e.g. "quiz me"); the "Not from your files:" label follows the answer's language; OCR keeps the original script. Arabic now displays right-to-left in chat answers, chat bubbles and the Create editor (`dir="auto"`, Tiptap `textDirection: "auto"`).
- Verified: English sentence splitting is identical to before (135/135 on the existing docs); Arabic and Russian samples now pass the gate (they gave 0 before); all 10 pages of the Arabic PDF are flagged for OCR and render to PNG.
- Not verified end to end: reprocessing the Arabic PDF hit the Gemini free tier's 500 requests/day limit (HTTP 429), so OCR couldn't run. The document is Failed with Retry; press Retry once the quota resets.

## Chat language rule (follow-up, user-specified)
- The user asked: "usually speak with the file language, but if the user speaks another, answer in his language". The rule now leads `CHAT_SYSTEM`: the file's language by default; a real sentence in another language gets the whole reply in that language (facts translated, citations kept); short commands ("quiz me") use the file's language.
- Verified with the real prompts on gemini-3.1-flash-lite: 12/12 (Arabic file + English, Arabic, French and "quiz me"; English file + Arabic and English), and the Arabic summary and flashcards come out in Arabic with pages.
