import type { FileType } from "@/lib/generated/prisma/enums";
import type { ManageLine, ManageOp, ManageResult } from "@/lib/manage/types";

/** A numbered source the answer can cite as [n]. */
export type ChatSource = { n: number; documentId: string; title: string; fileType: FileType; page: number };

export type ChatMessageView = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Sources the answer cited (only for assistant messages). */
  sources: ChatSource[];
  createdAt: string;
  /** User messages: the client id they were sent with (used to regenerate the answer). */
  clientId?: string | null;
  /** Create editor turns ("make it shorter"): shown in the chat, not saved. */
  edit?: { status: "running" | "done" | "info" | "error" | "stopped"; scope: "selection" | "document"; error?: string; reply?: string };
  /** Shown in this chat only, not saved (a plan of changes and the message that asked for it). */
  local?: boolean;
  /** Vappi's plan of changes to the Space: nothing runs until "Do it". */
  manage?: {
    reply: string;
    lines: ManageLine[];
    ops: ManageOp[];
    status: "ready" | "applying" | "applied" | "cancelled";
    results?: ManageResult[];
  };
};

/** One NDJSON line of the chat stream. */
export type ChatEvent =
  | { t: "step"; step: "search" }
  | { t: "step"; step: "found"; sources: ChatSource[] }
  | { t: "delta"; text: string }
  | { t: "done"; id: string; content: string; sources: ChatSource[] }
  | { t: "manage"; reply: string; lines: ManageLine[]; ops: ManageOp[] }
  | { t: "error"; message: string };

export const CHAT_MESSAGE_MAX = 2000;
/** Largest creation text sent to the chat as context (characters). */
export const DOCUMENT_CONTEXT_MAX = 30_000;
