# 26 — Smarter Ask: answer every question, never get stuck

The user's screenshot: "What are the key terms and what do they mean?" (one of our own suggested questions!) got "I couldn't find this in your files…". Earlier, "guide me through learning" got the "I'm Vappi…" intro again. The user wants Vappi to answer **all** questions in a smart way, and never loop or dead-end.

## Why it fails today (`lib/chat/answer.ts`, `lib/chat/intent.ts`)
1. **Broad questions find no passage.**
   - Retrieval is "nearest passages under cosine distance 0.5".
   - "Key terms", "main ideas", "summarise it" and "what is this about" are about the whole file, so no single passage is close enough. All of them are filtered out.
   - We then reply with the fixed `NOT_FOUND_REPLY` **without calling the AI at all**.
2. **The dead-end reply is canned.** It never tells the user what the files *do* cover or what to ask instead, so the user goes round in circles.
3. **Requests to learn are misrouted.** "Guide me", "teach me", "quiz me" and "where do I start" go to the `assistant` route (an identity reply) instead of being answered.

## Decisions

### A. Better context for every question
- **Overview pack:** every Ready document's saved summary (`short`, plus `long` trimmed to about 1,500 characters) and its `keyTerms` go to the AI in an `<overview>` block, on top of the excerpts. Broad questions then always have material to work from.
- **Key-term passages with pages:** for each key term (max 8), we take the first chunk that contains it, using a scoped `ILIKE` with a parameter in `$queryRaw` (user + Space filter). These become citable excerpts, so key-term answers link real pages.
- **No hard empty cut-off:**
  - Passages under the distance limit come first.
  - If fewer than 3 pass, the closest 4 are still sent as "possibly related".
  - The AI is called whenever the Space has at least one Ready file.
- **No Ready files at all:** a clear reply, "This Space has no ready files yet. Upload a file, and I'll answer from it.", without calling the AI.

### B. The answer prompt: helpful and never stuck
- **Covered by the files** (fully or partly, including through the overview):
  - answer clearly and cite pages `[n]`;
  - for "key terms" questions, list each term with its meaning from the files;
  - for "main ideas / summarise" questions, give a structured overview.
- **Learning requests** ("guide me", "teach me", "quiz me", "where do I start"):
  - **Guide / teach:** a short step-by-step path built from the files (start with X, then Y…), plus the next action in Vappi (read the summary, review flashcards, take a quiz).
  - **Quiz me:** ask 1–2 questions from the files and wait for the answer. Follow-ups grade the answer against the files.
- **Not covered by the files:** never a dead-end. See the question for the user below:
  - **Option 1 (recommended):**
    - say in one line that the files don't cover it;
    - then give a short, general answer, clearly labelled *"Not from your files:"* and with no page links;
    - then suggest 2 related questions the files *can* answer.
  - **Option 2 (strict AGENTS.md "grounded only"):** say the files don't cover it, mention what the files *do* say that's closest (with pages), and suggest 2–3 questions they can answer. No outside facts.
- No more fixed `NOT_FOUND_REPLY` from the model path (the `NOT_IN_NOTES` sentinel and the canned reply are removed). The "Searched your files" step and the sources still show.

### C. Routing
- `assistant` route only for "who/what are you", what you can do, and how the chat works, plus greetings, thanks and goodbyes.
- Everything else, including learning requests and vague messages, goes to the answer path.
- The identity reply also offers 3 concrete things to try ("Summarise this Space", "Explain the key terms", "Quiz me").

### Model and cost
- The same model (`gemini-3.5-flash-lite`). The overview pack adds roughly 2–6 K input tokens per question, and the 60 messages/hour limit stays.
- The overview is built per request from saved summaries; no new AI calls.

## Security
- File text, summaries and history stay inside data tags, and `escapeTags` covers the new `<overview>` tag.
- The key-term SQL uses tagged-template parameters, filtered by `userId` + `spaceId`.
- Nothing is logged except status.

## Files
- **Edit:**
  - `lib/chat/answer.ts` (retrieval, overview pack, remove the hard not-found path);
  - `lib/ai/prompts.ts` (`CHAT_SYSTEM`, `chatInput` with `<overview>`);
  - `lib/chat/intent.ts` (routing);
  - `lib/search/vector.ts` (the key-term passage query);
  - `lib/chat/small-talk.ts` (the greeting offers suggestions).

## Acceptance criteria
Real Gemini, on the user's "kids story" Space:
- "What are the key terms and what do they mean?" lists terms with meanings and page links.
- "What is this kid story?" and "Summarise it" give a real overview with pages.
- "Guide me through learning" gives a step-by-step path plus a Vappi next step.
- "Quiz me" asks a question; answering it gets feedback from the files.
- "What is the capital of France?" gets the not-covered handling of the chosen option, never the canned dead-end.
- "Who are you?" gives a short intro plus suggestions.
- A prompt-injection line inside a question doesn't change the rules.

## Checks
- tsc, lint, build.
- A script running the questions above through the real route, with the answers reviewed and the test messages deleted afterwards.

## Implementation notes (after building)
- **User's choice:** Option 1. Off-file questions get "Your files don't cover this." plus *"Not from your files:"* and a short general answer, plus 2 suggested questions. This deliberately relaxes the AGENTS.md grounded-only rule **for chat only**; summaries, cards, quizzes and Create stay grounded.
- **`lib/chat/answer.ts`:**
  - `overviewFor` loads the summaries and key terms of Ready files.
  - `retrieve` keeps at least 4 passages.
  - Key-term passages come from `chunksMentioning`, a new scoped `ILIKE` query in `lib/search/vector.ts` (wildcards escaped, database column `"subjectId"`).
  - Up to 14 excerpts.
  - `NOT_FOUND_REPLY` and the `NOT_IN_NOTES` sentinel were removed. `NO_FILES_REPLY` is used when the Space has no Ready file.
  - One automatic retry when the AI fails or returns nothing before writing.
- **Prompt:**
  - The new `CHAT_SYSTEM` rules: answer from the files with citations, key terms as a bold list, an overview for "what is this about", a guide path, quiz-and-grade, the labelled off-file answer, and no citations inside quiz questions.
  - `chatInput` gains an `<overview>` block, and `escapeTags` covers `overview` and `file`.
- **Routing:** the intent router sends only identity, greeting, thanks and bye to `assistant`. Everything else, including guide and quiz requests, gets an answer. The greeting and identity replies suggest "Summarise this Space / Explain the key terms / Quiz me".
- **Real Gemini results on "kids story":**
  - key terms → 9 terms with meanings and pages;
  - "what is this kid story" → overview plus main points;
  - "guide me" → a 3-step path plus a next step;
  - "quiz me" → a question; answering it → feedback plus the next question;
  - France and bread → the labelled general answer plus suggestions;
  - "who are you" → intro plus suggestions;
  - the injection attempt is ignored.
- One transient "Couldn't answer" on "next" didn't reproduce. That led to the retry above.
- All test messages and usage events were deleted.
