/**
 * JSON Schemas sent to Gemini's structured output. They mirror ./schemas.ts,
 * but Gemini ignores some keywords (minLength, maxLength, uniqueItems…), so
 * the Zod schemas remain the real check. Arrays are wrapped in an object.
 */

const page = (pages: number[]) => ({
  type: "integer",
  description: `The page the item comes from. One of: ${pages.join(", ")}.`,
  minimum: Math.min(...pages),
  maximum: Math.max(...pages),
});

export const sectionSummaryJson = (pages: number[]) => ({
  type: "object",
  properties: {
    points: {
      type: "array",
      minItems: 1,
      maxItems: 30,
      items: {
        type: "object",
        properties: {
          text: { type: "string", description: "One key point, 1–2 sentences, max 600 characters." },
          page: page(pages),
        },
        required: ["text", "page"],
      },
    },
    keyTerms: { type: "array", maxItems: 20, items: { type: "string" } },
  },
  required: ["points", "keyTerms"],
});

export const summaryJson = {
  type: "object",
  properties: {
    short: { type: "string", description: "2–3 sentence overview, max 600 characters." },
    long: { type: "string", description: "Fuller summary in short paragraphs, max 8000 characters." },
    keyTerms: {
      type: "array",
      minItems: 3,
      maxItems: 15,
      items: { type: "string", description: "A term that appears word-for-word in `long`." },
    },
  },
  required: ["short", "long", "keyTerms"],
};

export const flashcardsJson = (pages: number[], max: number) => ({
  type: "object",
  properties: {
    cards: {
      type: "array",
      maxItems: max,
      items: {
        type: "object",
        properties: {
          front: { type: "string", description: "A question or prompt, max 300 characters." },
          back: { type: "string", description: "The answer from the material, max 600 characters." },
          page: page(pages),
        },
        required: ["front", "back", "page"],
      },
    },
  },
  required: ["cards"],
});

export const questionsJson = (pages: number[], max: number) => ({
  type: "object",
  properties: {
    questions: {
      type: "array",
      maxItems: max,
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["MULTIPLE_CHOICE", "SHORT_ANSWER"] },
          question: { type: "string" },
          options: {
            type: "array",
            maxItems: 4,
            items: { type: "string" },
            description: "Exactly 4 distinct options for MULTIPLE_CHOICE (one is the answer, word for word); empty for SHORT_ANSWER.",
          },
          answer: { type: "string" },
          explanation: { type: "string", description: "Why this is the answer, from the material, 1–2 sentences." },
          page: page(pages),
        },
        required: ["type", "question", "options", "answer", "explanation", "page"],
      },
    },
  },
  required: ["questions"],
});

export const gradeJson = {
  type: "object",
  properties: {
    correct: { type: "boolean" },
    feedback: { type: "string", description: "1–2 sentences for the user, max 400 characters." },
  },
  required: ["correct", "feedback"],
};
