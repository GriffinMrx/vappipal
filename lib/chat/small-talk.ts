/**
 * Greetings / thanks / ok / bye on their own: answered without searching the
 * notes or calling the AI (nothing to look up, so no "Searching…" either).
 * Pure: unit-tested.
 */

const GREETING = [
  "hi", "hii", "hiii", "hello", "hey", "heya", "yo", "hola", "salut", "bonjour", "bonsoir", "coucou",
  "salam", "salaam", "assalamualaikum", "salam alaikum", "as-salamu alaykum", "good morning", "good afternoon",
  "good evening", "مرحبا", "اهلا", "أهلا", "السلام عليكم", "سلام", "hi there", "hello there", "hey there",
];
const THANKS = [
  "thanks", "thank you", "thx", "ty", "merci", "merci beaucoup", "gracias", "شكرا", "شكرا لك", "thanks a lot",
  "thank you so much", "great thanks", "perfect thanks", "cool thanks",
];
const ACK = ["ok", "okay", "k", "cool", "nice", "great", "perfect", "got it", "bye", "goodbye", "see you", "d'accord", "vale"];

export type SmallTalk = "greeting" | "thanks" | "ack";

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[!?.,;:…"`~*_()؟،]+/g, " ")
    .replace(/\p{Extended_Pictographic}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export function smallTalk(message: string): SmallTalk | null {
  const text = normalize(message);
  if (!text || text.split(" ").length > 5) return null;
  // Allow a trailing name/word like "hi vappi" or "thanks bro".
  const variants = [text, text.split(" ").slice(0, -1).join(" ")].filter(Boolean);
  for (const v of variants) {
    if (GREETING.includes(v)) return "greeting";
    if (THANKS.includes(v)) return "thanks";
    if (ACK.includes(v)) return "ack";
  }
  return null;
}

export function smallTalkReply(kind: SmallTalk, spaceName: string): string {
  if (kind === "greeting")
    return `Hi! Ask me anything about ${spaceName} and I'll answer from your files, with links to the pages. You can also say "Summarise this Space", "Explain the key terms" or "Quiz me".`;
  if (kind === "thanks") return "You're welcome! Ask another question whenever you're ready.";
  return "Anything else you want to know? I'll answer from your files.";
}
