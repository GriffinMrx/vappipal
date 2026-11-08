// Create mode shapes and constants, shared by server and client (no server-only imports).

import type { WritingSpeed } from "@/lib/settings/writing-speed";
import type { ChatSource } from "@/lib/chat/types";
import type { EditOp } from "./edit-plan";
import type { CreationStatus, CreationType } from "@/lib/generated/prisma/enums";

export type { CreationStatus, CreationType };

export const CREATION_TYPES = ["NOTES", "OUTLINE", "CHECKLIST", "EMAIL", "BLOG_POST"] as const satisfies readonly CreationType[];

export const TYPE_INFO: Record<CreationType, { label: string; description: string; emoji: string; slug: string }> = {
  NOTES: { label: "Notes", description: "Clear notes with headings and key points", emoji: "📝", slug: "notes" },
  OUTLINE: { label: "Outline", description: "A structured, numbered outline", emoji: "🧭", slug: "outline" },
  CHECKLIST: { label: "Checklist", description: "Steps or items to tick off", emoji: "✅", slug: "checklist" },
  EMAIL: { label: "Email", description: "A ready-to-send email", emoji: "✉️", slug: "email" },
  BLOG_POST: { label: "Blog post", description: "An article with intro, sections and ending", emoji: "📰", slug: "blog post" },
};

/** Banner gradients from the design-system palette (stored by key). */
export const BANNERS = {
  violet: "linear-gradient(120deg, #3b1a78 0%, #6b3fd1 55%, #a77dff 100%)",
  dusk: "linear-gradient(120deg, #1d1b3a 0%, #3b2d6b 50%, #8b5cf6 100%)",
  ocean: "linear-gradient(120deg, #0d2a4a 0%, #1f5fa8 55%, #4f8cff 100%)",
  forest: "linear-gradient(120deg, #0f2e24 0%, #1d6b52 55%, #22c55e 100%)",
  ember: "linear-gradient(120deg, #3a1610 0%, #9a3412 55%, #f97316 100%)",
  rose: "linear-gradient(120deg, #3a1027 0%, #9d174d 55%, #ec4899 100%)",
} as const;
export type BannerKey = keyof typeof BANNERS;
export const BANNER_KEYS = Object.keys(BANNERS) as BannerKey[];

/** The icon picker's curated emojis (no emoji library). */
export const EMOJIS = [
  "📝", "🧭", "✅", "✉️", "📰", "📚", "📖", "💼", "💡", "🎯",
  "🚀", "🧪", "🧠", "📊", "📈", "🗂️", "📌", "⭐", "🔥", "🌱",
  "🎨", "🎵", "🍳", "🏃", "🌍", "🧩", "🛠️", "💬", "📣", "🗓️",
  "🏆", "❤️", "🌙", "☀️", "🐾", "🎓", "💰", "🔬", "🏠", "✈️",
];

export const TITLE_MAX = 120;
export const INSTRUCTION_MAX = 300;
export const EDIT_INSTRUCTION_MAX = 600;
/** Largest saved document (JSON characters). */
export const CONTENT_MAX = 200_000;
/** AI edits per user per hour (cost guard). */
export const CREATE_EDITS_PER_HOUR = 60;

export type CreationSourceRef = { documentId: string; page: number };

export type CreationListItem = {
  id: string;
  type: CreationType;
  title: string;
  icon: string | null;
  status: CreationStatus;
  pages: number;
  updatedAt: string;
};

export type CreationView = CreationListItem & {
  spaceId: string;
  banner: BannerKey | null;
  instruction: string | null;
  /** Tiptap JSON document (null while it's only Markdown). */
  content: unknown;
  markdown: string | null;
  sources: ChatSource[];
};

/** NDJSON events of the generate and edit routes. */
export type CreationEvent =
  | { t: "created"; id: string; title: string }
  /** First line of every run: the user's writing speed right now (from the database). */
  | { t: "speed"; speed: WritingSpeed }
  | { t: "step"; step: "search" }
  | { t: "found"; sources: ChatSource[] }
  | { t: "delta"; text: string }
  | { t: "done"; markdown: string; sources: ChatSource[]; title?: string }
  | { t: "ask" }
  | { t: "plan"; reply: string; ops: EditOp[]; sources: ChatSource[] }
  | { t: "error"; message: string };

export type CreationActionResult = { ok: true } | { ok: false; error: string };
