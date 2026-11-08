import "server-only";

import { z } from "zod";

/**
 * Plan limits and Lemon Squeezy variants, from env (AGENTS.md §7). Components
 * never hard-code limits; they get them from `checkLimit` / this config.
 * `null` means unlimited.
 */

const positiveInt = (fallback: number) =>
  z.preprocess((v) => (v === undefined || v === "" ? fallback : v), z.coerce.number().int().min(0));

const env = z
  .object({
    FREE_MAX_DOCUMENTS: positiveInt(3),
    FREE_MAX_FLASHCARDS: positiveInt(50),
    FREE_MAX_QUIZZES_PER_WEEK: positiveInt(2),
    FREE_MAX_CREATIONS_PER_WEEK: positiveInt(3),
    FREE_MAX_FILE_MB: positiveInt(20),
    PRO_MAX_FILE_MB: positiveInt(50),
    FREE_MAX_PAGES: positiveInt(50),
    PRO_MAX_PAGES: positiveInt(300),
    CARDS_PER_DOCUMENT_MAX: positiveInt(30),
    QUESTIONS_PER_DOCUMENT_MAX: positiveInt(12),
    CHAT_MAX_PER_HOUR: positiveInt(60),
    CHAT_MAX_DISTANCE: z.preprocess((v) => (v === undefined || v === "" ? undefined : v), z.coerce.number().min(0).max(2).optional()),
    PRICE_PRO_MONTHLY: z.preprocess((v) => (v === undefined || v === "" ? 7 : v), z.coerce.number().min(0)),
    PRICE_PRO_YEARLY: z.preprocess((v) => (v === undefined || v === "" ? 49 : v), z.coerce.number().min(0)),
    PRICE_PASS: z.preprocess((v) => (v === undefined || v === "" ? 15 : v), z.coerce.number().min(0)),
    PRICE_CURRENCY: z.string().optional().default("USD").transform((v) => v || "USD"),
    BILLING_PROVIDER: z.enum(["mock", "lemonsqueezy", ""]).optional().transform((v) => (v ? v : "mock")),
    BILLING_MOCK_IN_PRODUCTION: z.enum(["true", "false", ""]).optional().transform((v) => v === "true"),
    LEMONSQUEEZY_TEST_MODE: z
      .enum(["true", "false", ""])
      .optional()
      .transform((v) => v !== "false"), // default to test mode until explicitly live
    LEMONSQUEEZY_VARIANT_PRO_MONTHLY: z.string().optional().default(""),
    LEMONSQUEEZY_VARIANT_PRO_YEARLY: z.string().optional().default(""),
    LEMONSQUEEZY_VARIANT_PASS: z.string().optional().default(""),
  })
  .parse({
    ...process.env,
    // Renamed from the "Exam Pass" days (now the 30-Day Pass); the old names still work.
    PRICE_PASS: process.env.PRICE_PASS ?? process.env.PRICE_EXAM_PASS,
    LEMONSQUEEZY_VARIANT_PASS: process.env.LEMONSQUEEZY_VARIANT_PASS ?? process.env.LEMONSQUEEZY_VARIANT_EXAM_PASS,
  });

export type LimitKind = "document" | "flashcards" | "quiz";

export type PlanLimits = Record<LimitKind, number | null>;

export const FREE_LIMITS: PlanLimits = {
  document: env.FREE_MAX_DOCUMENTS,
  flashcards: env.FREE_MAX_FLASHCARDS,
  quiz: env.FREE_MAX_QUIZZES_PER_WEEK,
};

export const PRO_LIMITS: PlanLimits = { document: null, flashcards: null, quiz: null };

/** Largest single upload, in bytes, per plan. */
export const MAX_FILE_BYTES = {
  free: env.FREE_MAX_FILE_MB * 1024 * 1024,
  pro: env.PRO_MAX_FILE_MB * 1024 * 1024,
} as const;

/** Most pages (slides) read from one file, per plan. Caps processing cost (AGENTS.md §12). */
export const MAX_PAGES = { free: env.FREE_MAX_PAGES, pro: env.PRO_MAX_PAGES } as const;

/** How much study material one document gets (generated once, AGENTS.md §7). */
export const STUDY_AMOUNTS = {
  cardsPerDocument: env.CARDS_PER_DOCUMENT_MAX,
  questionsPerDocument: env.QUESTIONS_PER_DOCUMENT_MAX,
} as const;

/**
 * Free creations per week (Create mode). Enforced when Create ships (prompt 25);
 * shown on the billing page now.
 */
export const FREE_CREATIONS_PER_WEEK = env.FREE_MAX_CREATIONS_PER_WEEK;

/** Quiz limit window (rolling). */
export const QUIZ_WINDOW_DAYS = 7;

/** The 30-Day Pass gives Pro for this many days from purchase. */
export const PASS_DAYS = 30;

/** Billing runs on Lemon Squeezy test-mode keys/products unless set to "false". */
export const BILLING_TEST_MODE = env.LEMONSQUEEZY_TEST_MODE;

export const VARIANTS = {
  proMonthly: env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY,
  proYearly: env.LEMONSQUEEZY_VARIANT_PRO_YEARLY,
  pass: env.LEMONSQUEEZY_VARIANT_PASS,
} as const;

/** Chat: messages per user per hour (cost guard), and how far (cosine distance) a passage may be and still count. */
export const CHAT_LIMITS = {
  perHour: env.CHAT_MAX_PER_HOUR,
  /** undefined → the default for the current embedding model. */
  maxDistance: env.CHAT_MAX_DISTANCE,
} as const;

/** Display prices (env), never hard-coded in components. */
export const PRICES = {
  proMonthly: env.PRICE_PRO_MONTHLY,
  proYearly: env.PRICE_PRO_YEARLY,
  pass: env.PRICE_PASS,
  currency: env.PRICE_CURRENCY,
} as const;

/**
 * Payments are mocked until Lemon Squeezy is connected. The mock is refused on
 * a production deployment unless explicitly allowed.
 */
export const BILLING = {
  provider: env.BILLING_PROVIDER as "mock" | "lemonsqueezy",
  mockAllowed:
    env.BILLING_PROVIDER === "mock" && (process.env.VERCEL_ENV !== "production" || env.BILLING_MOCK_IN_PRODUCTION),
} as const;
