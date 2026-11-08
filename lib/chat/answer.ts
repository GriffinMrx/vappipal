import "server-only";

import { AiDailyLimitError, MODELS, streamText } from "@/lib/ai/gemini";
import { aiErrorMessage } from "@/lib/ai/limit-message";
import { CHAT_SYSTEM, chatInput } from "@/lib/ai/prompts";
import { aiProvider } from "@/lib/ai/study";
import { splitSentences } from "@/lib/ai/text";
import { db } from "@/lib/db";
import { chunksMentioning } from "@/lib/search/vector";
import { overviewFor, retrieve } from "./context";
import { RetryAfterError } from "inngest";
import { citedNumbers, stripInvalidCitations } from "./citations";
import { classifyIntent } from "./intent";
import { smallTalk, smallTalkReply } from "./small-talk";
import type { ChatEvent, ChatSource } from "./types";

/**
 * Ask your files (AGENTS.md §9.7): find the closest chunks in THIS
 * user's THIS Space plus each file's saved summary and key terms, send only
 * those to the AI, and stream an answer that cites pages as [n]. Every
 * question gets a real answer: whole-file questions use the overview, and
 * anything the files don't cover is answered briefly and labelled as not
 * from the files (the user's choice, prompt 26).
 */

export const NO_FILES_REPLY =
  "This Space has no ready files yet. Upload a file, and I'll answer from it with links to the pages.";

const HISTORY = 6;
/** Key terms looked up for page-linked passages. */
const TERM_PASSAGES = 8;
const MAX_EXCERPTS = 14;

/** MOCK: an extractive answer from the top passages, streamed word by word. */
async function* mockAnswer(excerpts: { id: number; page: number; text: string }[]) {
  if (excerpts.length === 0) {
    yield "Your files don't have text I can use for this yet.";
    return;
  }
  const picked = excerpts.slice(0, 2).map((e) => {
    const first = splitSentences([{ page: e.page, text: e.text }])
      .slice(0, 2)
      .map((s) => s.text)
      .join(" ");
    return `${first || e.text.slice(0, 240)} [${e.id}]`;
  });
  const text = `From your files: ${picked.join(" ")}`;
  for (const word of text.split(/(?<=\s)/)) {
    await new Promise((r) => setTimeout(r, 12));
    yield word;
  }
}

/** Saved citations → sources with titles (documents deleted since are dropped). */
export async function sourcesFor(userId: string, cites: { n: number; documentId: string; page: number }[]) {
  if (cites.length === 0) return [];
  const docs = await db.document.findMany({
    where: { userId, id: { in: [...new Set(cites.map((c) => c.documentId))] } },
    select: { id: true, title: true, fileType: true },
  });
  const byId = new Map(docs.map((d) => [d.id, d]));
  return cites.flatMap((c): ChatSource[] => {
    const d = byId.get(c.documentId);
    return d ? [{ n: c.n, documentId: d.id, title: d.title, fileType: d.fileType, page: c.page }] : [];
  });
}

export async function* answerQuestion({
  userId,
  spaceId,
  clientId,
  message,
  signal,
  regenerate,
  document,
}: {
  userId: string;
  spaceId: string;
  clientId: string;
  message: string;
  signal?: AbortSignal;
  /** Replace the answer to this (latest) question. The route has checked it. */
  regenerate?: boolean;
  /** The creation the user has open (Create editor): context for "this / it". */
  document?: { title: string; markdown: string } | null;
}): AsyncGenerator<ChatEvent> {
  // 1. Save the user's message (idempotent on clientId: a retry never duplicates it).
  const saved = await db.chatMessage.upsert({
    where: { userId_clientId: { userId, clientId } },
    create: { userId, spaceId, role: "USER", content: message, clientId },
    update: {},
    select: { id: true, createdAt: true, content: true },
  });
  if (regenerate) {
    // Drop the old answer(s) to this question; the new one replaces them.
    await db.chatMessage.deleteMany({
      where: { userId, spaceId, role: "ASSISTANT", createdAt: { gt: saved.createdAt } },
    });
    message = saved.content; // always re-ask the stored question
  }
  const history = (
    await db.chatMessage.findMany({
      where: { userId, spaceId, createdAt: { lt: saved.createdAt }, id: { not: saved.id } },
      orderBy: { createdAt: "desc" },
      take: HISTORY,
      select: { role: true, content: true },
    })
  )
    .reverse()
    .map((m) => ({ role: m.role === "USER" ? ("user" as const) : ("assistant" as const), content: m.content.slice(0, 1500) }));
  const previous = [...history].reverse().find((m) => m.role === "user")?.content ?? null;

  const finish = async (content: string, cited: ChatSource[]): Promise<ChatEvent> => {
    const row = await db.chatMessage.create({
      data: {
        userId,
        spaceId,
        role: "ASSISTANT",
        content,
        citations: cited.map((s) => ({ n: s.n, documentId: s.documentId, page: s.page })),
      },
      select: { id: true },
    });
    return { t: "done", id: row.id, content, sources: cited };
  };

  const space = await db.space.findFirst({ where: { id: spaceId, userId }, select: { name: true } });
  const spaceName = space?.name ?? "this space";

  // "hi" / "thanks": nothing to look up → no search, no AI, no "Searching…".
  const talk = smallTalk(message);
  if (talk) {
    const reply = smallTalkReply(talk, spaceName);
    yield { t: "delta", text: reply };
    yield await finish(reply, []);
    return;
  }

  // Messages to the assistant itself ("who are you?") get a short reply instead
  // of a search. The notes answer starts at the same time and is held back
  // until the check is done, so file questions aren't slower.
  const spec = new AbortController();
  const onAbort = () => spec.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const queue: NotesEvent[] = [];
    let ended = false;
    const waker: { fn: (() => void) | null } = { fn: null };
    const pump = (async () => {
      try {
        for await (const e of notesAnswer({ userId, spaceId, message, previous, history, document, signal: spec.signal })) {
          queue.push(e);
          waker.fn?.();
        }
      } catch (err) {
        if (!spec.signal.aborted) {
          console.error("Chat answer failed", (err as Error)?.name);
          queue.push({ t: "error", message: await aiErrorMessage(err, userId, "Couldn't answer right now. Try again.") });
        }
      } finally {
        ended = true;
        waker.fn?.();
      }
    })();

    const intent = await classifyIntent(message, spaceName, history);
    if (intent.kind === "assistant" && !signal?.aborted) {
      spec.abort(); // drop the speculative notes answer (nothing of it was shown or saved)
      await pump;
      yield { t: "delta", text: intent.reply };
      yield await finish(intent.reply, []);
      return;
    }

    // Release the notes answer: what's buffered, then live.
    while (true) {
      if (queue.length) {
        const e = queue.shift()!;
        if (e.t === "final") {
          yield await finish(e.content, e.sources);
          return;
        }
        yield e;
        if (e.t === "error") return;
        continue;
      }
      if (ended) return;
      await new Promise<void>((r) => (waker.fn = r));
      waker.fn = null;
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Internal: the notes path ends with "final" (the caller saves it). */
type NotesEvent = ChatEvent | { t: "final"; content: string; sources: ChatSource[] };

async function* notesAnswer({
  userId,
  spaceId,
  message,
  previous,
  history,
  document,
  signal,
}: {
  userId: string;
  spaceId: string;
  message: string;
  previous: string | null;
  history: { role: "user" | "assistant"; content: string }[];
  document?: { title: string; markdown: string } | null;
  signal: AbortSignal;
}): AsyncGenerator<NotesEvent> {
  // 2. Search this user's files in this Space (+ the overview, for whole-file questions).
  yield { t: "step", step: "search" };
  const [matches, { ready, overview }] = await Promise.all([
    retrieve(userId, spaceId, message, previous),
    overviewFor(userId, spaceId),
  ]);
  if (ready === 0) {
    yield { t: "step", step: "found", sources: [] };
    yield { t: "delta", text: NO_FILES_REPLY };
    yield { t: "final", content: NO_FILES_REPLY, sources: [] };
    return;
  }
  // Key terms → the first passage that mentions each one, so their pages can be cited.
  const terms = [...new Set(overview.flatMap((o) => o.keyTerms))].slice(0, TERM_PASSAGES);
  const termChunks = await chunksMentioning({ userId, spaceId, terms });
  const picked = new Map<string, { id: string; documentId: string; page: number; text: string }>();
  for (const m of [...matches, ...termChunks]) if (!picked.has(m.id) && picked.size < MAX_EXCERPTS) picked.set(m.id, m);

  const docs = await db.document.findMany({
    where: { userId, spaceId, id: { in: [...new Set([...picked.values()].map((m) => m.documentId))] } },
    select: { id: true, title: true, fileType: true },
  });
  const docById = new Map(docs.map((d) => [d.id, d]));
  const usable = [...picked.values()].filter((m) => docById.has(m.documentId));
  const sources: ChatSource[] = usable.map((m, i) => {
    const d = docById.get(m.documentId)!;
    return { n: i + 1, documentId: d.id, title: d.title, fileType: d.fileType, page: m.page };
  });
  yield { t: "step", step: "found", sources };

  // 3. Stream the answer (always: the prompt handles questions the files don't cover).
  const excerpts = usable.map((m, i) => ({
    id: i + 1,
    page: m.page,
    doc: docById.get(m.documentId)!.title,
    text: m.text,
  }));
  const stream = () =>
    aiProvider() === "gemini"
      ? streamText({
          model: MODELS.smart,
          system: CHAT_SYSTEM,
          input: chatInput(excerpts, overview, history, message, document),
          signal,
        })
      : mockAnswer(excerpts);

  // One automatic retry when the AI fails (or returns nothing) before writing anything.
  let text = "";
  for (let attempt = 1; ; attempt++) {
    let failure: unknown = null;
    try {
      for await (const piece of stream()) {
        if (signal.aborted) break;
        text += piece;
        yield { t: "delta", text: piece };
      }
    } catch (err) {
      failure = err;
    }
    if (signal.aborted || (text.trim() && !failure)) break;
    if (text.trim() === "" && attempt < 2 && !(failure instanceof RetryAfterError) && !(failure instanceof AiDailyLimitError)) continue;
    if (failure || text.trim() === "") {
      // Status only: never the question or the file text (AGENTS.md §12).
      console.error("Chat answer failed", failure instanceof RetryAfterError ? "busy" : ((failure as Error)?.name ?? "empty"));
      if (text.trim()) break; // keep the part that was written
      yield {
        t: "error",
        message: await aiErrorMessage(failure, userId, "Couldn't answer right now. Try again."),
      };
      return;
    }
    break;
  }
  if (text.trim() === "") return; // stopped before anything showed

  // 5. Keep only real citations; the caller saves (a stopped answer keeps what was written).
  const valid = new Set(sources.map((s) => s.n));
  const content = stripInvalidCitations(text, valid).trim();
  const used = new Set(citedNumbers(content));
  yield { t: "final", content, sources: sources.filter((s) => used.has(s.n)) };
}
