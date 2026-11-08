import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A quiz the server started for a user: user id + question ids + start time,
 * HMAC-signed. Answers are only accepted for questions in a valid token, so
 * the weekly Free quiz limit (counted in startQuiz) can't be skipped by
 * answering questions directly. No DB table needed.
 */

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function secret() {
  const base = process.env.QUIZ_TOKEN_SECRET || process.env.CLERK_SECRET_KEY;
  if (!base) throw new Error("No secret available for quiz tokens");
  // Derive a purpose-specific key so the Clerk secret itself is never used directly.
  return createHmac("sha256", base).update("vappi-quiz-token-v1").digest();
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");

export function signQuizToken(userId: string, questionIds: string[], now = Date.now()): string {
  const payload = b64(JSON.stringify({ u: userId, q: questionIds, t: now }));
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyQuizToken(
  token: string,
  userId: string,
  now = Date.now(),
): { questionIds: string[]; startedAt: number } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { u: string; q: string[]; t: number };
    if (data.u !== userId || !Array.isArray(data.q) || now - data.t > MAX_AGE_MS || data.t > now + 60_000) return null;
    return { questionIds: data.q, startedAt: data.t };
  } catch {
    return null;
  }
}
