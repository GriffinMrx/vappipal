// Plain module: word-level cues for the pal while Vappi writes.

import type { PalKick, PalMood } from "@/components/pal/vappi-pal";

/** What the pal does about the text it just wrote (cheap, word-level cues). */
export function reactionFor(chunk: string): { kick?: PalKick["kind"]; mood?: PalMood } | null {
  if (!chunk.trim()) return null;
  if (/!/.test(chunk) || /\b(amazing|wow|great|love|fun|excit\w*|treasure|win\w*|happy|yay|best|awesome|celebrat\w*)\b/i.test(chunk))
    return { kick: "hop", mood: "happy" };
  if (/\b(sad|cry\w*|lost|scared|afraid|hurt|danger\w*|alone|sorry|fell|fail\w*)\b/i.test(chunk)) return { kick: "nod", mood: "sad" };
  if (/(^|\n)#{1,3}\s/.test(chunk)) return { kick: "hop" };
  if (/\?/.test(chunk) || /\*\*/.test(chunk)) return { kick: "wiggle" };
  if (/(^|\n)\s*([-*+]|\d+\.)\s/.test(chunk)) return { kick: "nod" };
  return null;
}
