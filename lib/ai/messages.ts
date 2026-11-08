/** User-facing AI messages, safe to import in client components too. */

/**
 * Stored marker (Document.failureReason / DocumentStep.error) when the AI provider's
 * DAILY quota is used up. Pages swap it for the sentence with the reset time
 * (lib/ai/limit-reset.ts), so keep this exact text: older rows already hold it.
 */
export const AI_DAILY_LIMIT_MESSAGE = "Vappi's AI has reached its daily limit. Try again later.";

/** First sentence of the live message ("…limit. It resets at 9:00 AM (in 3 h)."). */
export const AI_LIMIT_HEAD = "Vappi's AI has reached its daily limit.";

/** A stored limit failure from before the last reset. */
export const AI_LIMIT_RESET_MESSAGE = "Vappi's AI limit has reset. Press Try again.";

/** Any of the daily-limit messages (stored marker, live sentence, or "has reset"). */
export function isAiLimitMessage(message: string | null | undefined): message is string {
  return !!message && (message.startsWith(AI_LIMIT_HEAD) || message === AI_LIMIT_RESET_MESSAGE);
}
