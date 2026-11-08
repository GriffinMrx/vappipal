import "server-only";

import { ApiError, GoogleGenAI } from "@google/genai";
import { NonRetriableError, RetryAfterError } from "inngest";

import { AI_DAILY_LIMIT_MESSAGE } from "./messages";

export { AI_DAILY_LIMIT_MESSAGE };

/**
 * The daily quota is used up: retrying in 30 s can't help (it resets in hours),
 * so jobs stop at once. Jobs store AI_DAILY_LIMIT_MESSAGE (a marker); pages and
 * streams show it with the reset time (lib/ai/limit-reset.ts, limit-message.ts).
 */
export class AiDailyLimitError extends NonRetriableError {
  constructor(options?: { cause?: unknown }) {
    super(AI_DAILY_LIMIT_MESSAGE, options);
    this.name = "AiDailyLimitError";
  }
}

/**
 * Server-only Gemini client (AGENTS.md §5: the key never reaches the browser).
 * Interactions API, `store: false` on every call. Model names come from env.
 *
 * FREE TIER NOTE: on the free tier Google may use requests to improve its
 * products. Fine for development with your own files; switch GEMINI_API_KEY
 * to a paid project before real users use the app.
 */

export const MODELS = {
  fast: process.env.AI_MODEL_FAST || "gemini-3.5-flash-lite",
  // Free tier: gemini-3.8-flash measured ~156 s per call (vs ~1 s for flash-lite),
  // too slow for grading a user is waiting on. Set AI_MODEL_SMART on a paid key.
  smart: process.env.AI_MODEL_SMART || "gemini-3.5-flash-lite",
  embedding: process.env.EMBEDDING_MODEL || "gemini-embedding-2",
} as const;

export const EMBEDDING_DIMS = 1536;

/** Background jobs: a slow call fails and is retried by Inngest instead of hanging. */
const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * No hidden SDK retries: the SDK otherwise retries a 429 twice with backoff, so
 * every failed call took ~36 s to surface (measured; 0.8 s without). Inngest
 * retries job steps and chat retries its answer, so failures surface at once.
 */
const NO_SDK_RETRIES = 0;

// Key renamed with the retry change, so a running dev server builds a fresh client.
const globalForGemini = globalThis as unknown as { geminiNoRetry?: GoogleGenAI };

/**
 * Testing only: AI_FORCE_DAILY_LIMIT=1 makes every Gemini call act as if the daily
 * quota is used up. Never active on Vercel production or the production Neon branch.
 */
function forcedDailyLimit(): boolean {
  const branch = process.env.NEON_BRANCH ?? "";
  if (process.env.VERCEL_ENV === "production" || branch === "production" || branch === "main") return false;
  return process.env.AI_FORCE_DAILY_LIMIT === "1";
}

function client(): GoogleGenAI {
  if (forcedDailyLimit()) throw new AiDailyLimitError();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  // attempts: 1 = no SDK retries for models.* calls (embeddings); interactions use maxRetries.
  return (globalForGemini.geminiNoRetry ??= new GoogleGenAI({ apiKey, httpOptions: { retryOptions: { attempts: 1 } } }));
}

/** Rate limits / overload → wait and retry the job step (doesn't use a normal retry). */
function mapError(err: unknown): never {
  if (err instanceof AiDailyLimitError) throw err;
  const status =
    err instanceof ApiError ? err.status : (err as { status?: number })?.status;
  // "limit: 500 requests per day on Free Tier…": no point retrying soon.
  if (status === 429 && /per\s*day|daily/i.test(String((err as Error)?.message ?? ""))) {
    console.error("Gemini daily limit reached");
    throw new AiDailyLimitError({ cause: err });
  }
  if (status === 429 || status === 503) {
    // Use the server's own hint ("retryDelay": "21s") when it gives one.
    const hint = /retry(?:Delay|\s+in)["\s:]*"?(\d+(?:\.\d+)?)s/i.exec(String((err as Error)?.message ?? ""));
    const wait = hint ? `${Math.ceil(Number(hint[1])) + 2}s` : "30s";
    throw new RetryAfterError(`Gemini ${status}`, wait, {
      cause: err instanceof Error ? err : undefined,
    });
  }
  // Log only the shape of the failure — never prompts, file text or the key.
  console.error(
    "Gemini call failed",
    status ?? (err instanceof Error ? err.name : "error"),
  );
  throw err;
}

type JsonSchema = Record<string, unknown>;

/** Structured output: returns the parsed JSON (validate it with Zod after). */
export async function generateJson(opts: {
  model: string;
  system: string;
  input: string | Array<Record<string, unknown>>;
  schema: JsonSchema;
  maxOutputTokens?: number;
  /** Whole-call timeout. Jobs can wait longer than a user-facing request. */
  timeoutMs?: number;
  /** "minimal" for quick routing decisions; "low" (default) for study material. */
  thinkingLevel?: "minimal" | "low";
}): Promise<unknown> {
  try {
    const interaction = await client().interactions.create(
      {
        model: opts.model,
        system_instruction: opts.system,
        input: opts.input as never,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: opts.schema,
        } as never,
        generation_config: {
          thinking_level: opts.thinkingLevel ?? "low",
          max_output_tokens: opts.maxOutputTokens ?? 8192,
        },
        store: false,
      },
      { timeout_ms: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, maxRetries: NO_SDK_RETRIES },
    );
    const text = interaction.output_text ?? "";
    try {
      return JSON.parse(text);
    } catch {
      return null; // invalid JSON → caller's Zod check fails → retried once
    }
  } catch (err) {
    mapError(err);
  }
}

/** Plain text output (OCR). */
export async function generateText(opts: {
  model: string;
  system?: string;
  input: string | Array<Record<string, unknown>>;
  maxOutputTokens?: number;
  timeoutMs?: number;
}): Promise<string> {
  try {
    const interaction = await client().interactions.create(
      {
        model: opts.model,
        ...(opts.system ? { system_instruction: opts.system } : {}),
        input: opts.input as never,
        generation_config: {
          thinking_level: "low",
          max_output_tokens: opts.maxOutputTokens ?? 8192,
        },
        store: false,
      },
      { timeout_ms: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, maxRetries: NO_SDK_RETRIES },
    );
    return interaction.output_text ?? "";
  } catch (err) {
    mapError(err);
  }
}

/**
 * Streamed plain text (chat). Yields text pieces only (never thoughts).
 * `signal` aborts the request when the user presses Stop.
 */
export async function* streamText(opts: {
  model: string;
  system: string;
  input: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  let stream: AsyncIterable<{ event_type: string; delta?: { type: string; text?: string }; error?: unknown }>;
  try {
    stream = (await client().interactions.create(
      {
        model: opts.model,
        system_instruction: opts.system,
        input: opts.input,
        generation_config: {
          thinking_level: "low",
          max_output_tokens: opts.maxOutputTokens ?? 2048,
        },
        store: false,
        stream: true,
      },
      {
        maxRetries: NO_SDK_RETRIES,
        // A passed signal overrides timeout_ms, so combine both.
        signal: AbortSignal.any([
          AbortSignal.timeout(opts.timeoutMs ?? 45_000),
          ...(opts.signal ? [opts.signal] : []),
        ]),
      },
    )) as never;
  } catch (err) {
    mapError(err);
  }
  try {
    for await (const event of stream) {
      if (event.event_type === "step.delta" && event.delta?.type === "text" && event.delta.text) {
        yield event.delta.text;
      } else if (event.event_type === "error") {
        throw Object.assign(new Error("Gemini stream error"), { status: (event.error as { code?: number })?.code });
      }
    }
  } catch (err) {
    if (opts.signal?.aborted) return;
    mapError(err);
  }
}

/** One 1536-dim vector per text (gemini-embedding-2 normalises at this size). */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  try {
    const res = await client().models.embedContent({
      model: MODELS.embedding,
      contents: texts.map((text) => ({ parts: [{ text }] })),
      config: { outputDimensionality: EMBEDDING_DIMS },
    });
    const vectors = (res.embeddings ?? []).map((e) => e.values ?? []);
    if (
      vectors.length !== texts.length ||
      vectors.some((v) => v.length !== EMBEDDING_DIMS)
    ) {
      throw new Error("Unexpected embedding response shape");
    }
    return vectors;
  } catch (err) {
    mapError(err);
  }
}
