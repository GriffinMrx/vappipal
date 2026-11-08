"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { clearChat } from "@/lib/chat/actions";
import { plainAnswer } from "@/lib/chat/format";
import { DOCUMENT_CONTEXT_MAX, type ChatEvent, type ChatMessageView, type ChatSource } from "@/lib/chat/types";
import { EDIT_INSTRUCTION_MAX } from "@/lib/creations/types";
import { useDocTarget, type DocTarget, type EditHistoryItem } from "@/components/create/editor-bridge";
import { cn } from "@/lib/cn";
import { palStore } from "@/components/pal/pal-store";
import { VappiPal, type PalMood } from "@/components/pal/vappi-pal";
import { CircleAlert, Check, ChevronDown, Maximize2, Minimize2, RotateCw, Search, Trash2, X } from "lucide-react";
import { startTransition, useEffect, useOptimistic, useRef, useState, type ReactNode } from "react";
import { AiTypingIndicator, TypingDots } from "./ai-typing-indicator";
import { AnswerText, SourceCards } from "./answer-text";
import { MessageActions } from "./message-actions";
import { ChatComposer } from "./chat-composer";
import { ManageCard } from "./manage-card";
import { useChatPanel } from "./chat-panel";

type Live = {
  clientId: string;
  /** Only what the server has reported: nothing yet → searching → writing. */
  phase: "waiting" | "search" | "write";
  sources: ChatSource[] | null;
  text: string;
  startedAt: number;
};

const EXAMPLES = [
  "Explain the main ideas simply",
  "What are the key terms and what do they mean?",
  "What are the most important points?",
];
const DOC_EXAMPLES = ["Make it shorter", "Make it more friendly", "Add a short summary at the end"];

/** Read the clock in event handlers (kept out of render by the purity lint). */
const clockNow = () => Date.now();

let seq = 0;
const newClientId = () => `${Date.now().toString(36)}-${(++seq).toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Ask your files: streamed, grounded answers with page links
 * (AGENTS.md §11). Lives in the space page's side panel; expands to a full
 * screen view (and is always full screen on narrow screens).
 */
export function SpaceChat({
  spaceId,
  spaceName,
  initialMessages,
}: {
  spaceId: string;
  spaceName: string;
  initialMessages: ChatMessageView[];
}) {
  const { toast } = useToast();
  const { expanded, docked, setOpen, setExpanded } = useChatPanel();
  const big = expanded || !docked;
  const [confirmed, setConfirmed] = useState(initialMessages);
  const [optimistic, addOptimistic] = useOptimistic(confirmed, (state, a: ChatMessageView | "clear") =>
    a === "clear" ? [] : [...state, a],
  );
  const [confirmClear, setConfirmClear] = useState(false);
  const [live, setLive] = useState<Live | null>(null);
  const [draft, setDraft] = useState("");
  // An unsent message survives leaving the page (per Space, this browser only).
  const draftKey = `vappi.chat.draft.${spaceId}`;
  useEffect(() => {
    const saved = window.localStorage.getItem(draftKey);
    // Browser-only state, read after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setDraft((d) => d || saved);
  }, [draftKey]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (draft.trim()) window.localStorage.setItem(draftKey, draft);
      else window.localStorage.removeItem(draftKey);
    }, 300);
    return () => clearTimeout(t);
  }, [draft, draftKey]);
  const [worked, setWorked] = useState<Record<string, number>>({});
  const abort = useRef<AbortController | null>(null);
  const failed = useRef<{ clientId: string; text: string } | null>(null);
  /** The question was sent (and saved) but answering failed: shown inline with "Try again". */
  const [answerError, setAnswerError] = useState<{ clientId: string; message: string; error: string } | null>(null);
  /** The answer that just arrived: its pal is happy for a moment. */
  const [happyId, setHappyId] = useState<string | null>(null);
  useEffect(() => {
    if (!happyId) return;
    const t = setTimeout(() => setHappyId(null), 1600);
    return () => clearTimeout(t);
  }, [happyId]);

  // What the pal shows while an answer runs, mirrored next to the logo (palStore).
  const liveMood: PalMood | null = live
    ? live.text
      ? "writing"
      : live.phase === "search"
        ? "searching"
        : live.phase === "write"
          ? "writing"
          : "thinking"
    : null;
  // "searching" and "found" often arrive together: keep the search look on
  // screen for a moment so the pal (and the user) actually see it.
  const [shownMood, setShownMood] = useState<PalMood | null>(null);
  const searchSince = useRef(0);
  useEffect(() => {
    if (!liveMood) return;
    if (liveMood === "searching") searchSince.current = Date.now();
    const wait = liveMood === "writing" && searchSince.current ? 700 - (Date.now() - searchSince.current) : 0;
    const apply = () => {
      setShownMood(liveMood);
      palStore.set(liveMood);
    };
    if (wait <= 0) {
      const t = setTimeout(apply, 0);
      return () => clearTimeout(t);
    }
    // Pass through "searching" first if we never showed it.
    const t1 = setTimeout(() => {
      setShownMood("searching");
      palStore.set("searching");
    }, 0);
    const t2 = setTimeout(apply, wait);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [liveMood]);
  useEffect(() => {
    if (!live) searchSince.current = 0;
  }, [live]);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  /** The creation open beside this chat (Create editor), if any. */
  const doc = useDocTarget();
  const [docTurn, setDocTurn] = useState(false);
  const docRef = useRef(doc);
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);
  const busy = live !== null || docTurn || !!doc?.busy;

  // Keep the newest content in view while the user is at the bottom.
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [optimistic.length, live?.text, live?.phase, big]);

  useEffect(() => () => abort.current?.abort(), []);

  const messages = dedupe(optimistic);
  const empty = messages.length === 0 && !live;

  function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    if (doc) return void docSend(message);
    // Re-sending the same failed text reuses its id, so the server never stores it twice.
    const clientId = failed.current?.text === message ? failed.current.clientId : newClientId();
    failed.current = null;
    setDraft("");
    run({ clientId, message, regenerate: false });
  }

  /**
   * On a creation: Vappi edits the document live, unless the message is a
   * question (the server decides), which is then answered here as usual.
   * Edit turns are shown in the chat but not saved.
   */
  async function docSend(message: string) {
    const target: DocTarget | null = doc;
    if (!target) {
      toast({ tone: "error", title: "Not ready yet", description: "Wait until Vappi has finished writing the document." });
      return;
    }
    const scope = target.selection ? ("selection" as const) : ("document" as const);
    // The latest turns (before this one), so "yes" / "both of them" make sense to Vappi.
    const history: EditHistoryItem[] = messages
      .map((m) => ({ role: m.role, content: (m.content || m.edit?.reply || "").trim().slice(0, 600) }))
      .filter((m): m is EditHistoryItem => (m.role === "user" || m.role === "assistant") && m.content.length > 0)
      .slice(-8);
    const id = `edit-${newClientId()}`;
    const at = new Date().toISOString();
    const question: ChatMessageView = { id: `${id}-q`, role: "user", content: message, sources: [], createdAt: at, edit: { status: "done", scope } };
    const row: ChatMessageView = { id, role: "assistant", content: "", sources: [], createdAt: at, edit: { status: "running", scope } };
    const update = (edit: NonNullable<ChatMessageView["edit"]>) =>
      setConfirmed((c) => c.map((m) => (m.id === id ? { ...m, edit } : m)));
    stick.current = true;
    setDraft("");
    setAnswerError(null);
    setDocTurn(true);
    setConfirmed((c) => [...c, question, row]);
    // Full-screen chat on small screens: get out of the way so the edit can be watched.
    const outcome = await target.edit(
      message,
      true,
      () => {
        if (!docked) setOpen(false);
      },
      history,
    );
    setDocTurn(false);
    if (outcome.kind === "ask") {
      setConfirmed((c) => c.filter((m) => m.id !== id && m.id !== question.id));
      run({ clientId: newClientId(), message, regenerate: false });
      return;
    }
    if (outcome.kind === "edited") update({ status: "done", scope: outcome.scope, reply: outcome.reply });
    else if (outcome.kind === "info") update({ status: "info", scope, reply: outcome.reply });
    else if (outcome.kind === "stopped") update({ status: "stopped", scope });
    else {
      update({ status: "error", scope, error: outcome.message });
      setDraft((d) => d || message); // never lose what they typed
    }
  }

  /** Re-ask the latest question (after an error, or to get a different answer). */
  function regenerate(clientId: string, message: string) {
    if (busy) return;
    setAnswerError(null);
    // The old answer goes away now; the new one streams in (not optimistic: real progress).
    setConfirmed((c) => {
      const at = c.findIndex((m) => m.role === "user" && (m.clientId ?? m.id) === clientId);
      return at === -1 ? c : c.slice(0, at + 1);
    });
    run({ clientId, message, regenerate: true });
  }

  function run({ clientId, message, regenerate }: { clientId: string; message: string; regenerate: boolean }) {
    const userMsg: ChatMessageView = {
      id: clientId,
      clientId,
      role: "user",
      content: message,
      sources: [],
      createdAt: new Date().toISOString(),
    };
    stick.current = true;
    setAnswerError(null);

    const startedAt = clockNow();
    // Shown right away (outside the transition): set inside it, React would hold
    // this update until the whole send finished, hiding the "thinking" state.
    setLive({ clientId, phase: "waiting", sources: null, text: "", startedAt });

    startTransition(async () => {
      if (!regenerate) addOptimistic(userMsg);
      const controller = new AbortController();
      abort.current = controller;
      let state: Live = { clientId, phase: "waiting", sources: null, text: "", startedAt };
      let accepted = false; // the server took the question (it's saved from here on)

      // Not sent: roll back and give the text back (AGENTS.md §7).
      const rollback = (title: string, description?: string) => {
        palStore.set("sad", 2500);
        setLive(null);
        toast({ tone: "error", title, description });
        if (regenerate) return setAnswerError({ clientId, message, error: description ?? title });
        failed.current = { clientId, text: message };
        setDraft((d) => d || message); // never lose what they typed
      };
      // Sent, but no answer: keep the question and offer "Try again" right there.
      const answerFailed = (error: string) => {
        palStore.set("sad", 2500);
        startTransition(() => {
          if (!regenerate) setConfirmed((c) => [...c, userMsg]);
          setAnswerError({ clientId, message, error });
          setLive(null);
        });
      };

      try {
        const res = await fetch(`/api/spaces/${spaceId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            message,
            ...(regenerate ? { regenerate: true } : {}),
            // The open creation is context for "this / it".
            ...(docRef.current
              ? { document: { title: docRef.current.title.slice(0, 200), markdown: docRef.current.markdown().slice(0, DOCUMENT_CONTEXT_MAX) } }
              : {}),
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const err = (await res.json().catch(() => ({}))) as { error?: string; limit?: number };
          if (err.error === "pro") return rollback("Chat is a Pro feature", "Upgrade to ask your files.");
          if (err.error === "rate_limited")
            return rollback("Slow down a little", `You've reached ${err.limit} messages an hour. Try again soon.`);
          if (err.error === "not_latest") return rollback("Can't regenerate", "Only the latest answer can be regenerated.");
          if (res.status === 401) return rollback("You're signed out", "Sign in again to keep chatting.");
          return rollback("Message not sent", "Something went wrong. Try again.");
        }

        accepted = true;
        let done: Extract<ChatEvent, { t: "done" }> | null = null;
        let plan: Extract<ChatEvent, { t: "manage" }> | null = null;
        for await (const event of readEvents(res.body)) {
          if (event.t === "step" && event.step === "search") {
            searchSince.current = clockNow(); // the pal shows "searching" for a moment even if "found" follows at once
            state = { ...state, phase: "search" };
          }
          else if (event.t === "step" && event.step === "found") state = { ...state, phase: "write", sources: event.sources };
          else if (event.t === "delta") state = { ...state, text: state.text + event.text };
          else if (event.t === "done") done = event;
          else if (event.t === "manage") plan = event;
          else if (event.t === "error") return answerFailed(event.message);
          setLive(state);
        }
        if (plan) {
          // A plan of changes: shown here (not saved); nothing changes until "Do it".
          const p = plan;
          palStore.set("happy", 1600);
          startTransition(() => {
            setConfirmed((c) => [
              ...c,
              { ...userMsg, local: true },
              {
                id: `manage-${clientId}`,
                role: "assistant",
                content: p.reply,
                sources: [],
                createdAt: new Date().toISOString(),
                local: true,
                manage: { reply: p.reply, lines: p.lines, ops: p.ops, status: "ready" },
              },
            ]);
            setLive(null);
          });
          return;
        }
        if (!done) return answerFailed("The connection dropped before the answer finished.");
        const answer: ChatMessageView = {
          id: done.id,
          role: "assistant",
          content: done.content,
          sources: done.sources,
          createdAt: new Date().toISOString(),
        };
        const final = done;
        const searched = state.phase !== "waiting";
        palStore.set("happy", 1600);
        startTransition(() => {
          setHappyId(final.id);
          setConfirmed((c) => (regenerate ? [...c, answer] : [...c, userMsg, answer]));
          // The "Worked for" trace only on answers that actually searched the notes.
          if (searched) setWorked((w) => ({ ...w, [final.id]: Date.now() - startedAt }));
          setLive(null);
        });
      } catch {
        if (controller.signal.aborted) {
          // Stop keeps the partial answer (the server saves it too).
          palStore.set("idle");
          const partial: ChatMessageView[] = state.text.trim()
            ? [{ id: `stopped-${clientId}`, role: "assistant", content: state.text.trim(), sources: state.sources ?? [], createdAt: new Date().toISOString() }]
            : [];
          startTransition(() => {
            setConfirmed((c) => (regenerate ? [...c, ...partial] : [...c, userMsg, ...partial]));
            setLive(null);
          });
          return;
        }
        if (accepted) return answerFailed("The connection dropped before the answer finished.");
        rollback("Message not sent", "Check your connection and try again.");
      } finally {
        abort.current = null;
      }
    });
  }

  // Clear chat: optimistic (the list empties at once); on failure the
  // messages come back on their own and a toast explains. The draft is untouched.
  function clearAll() {
    setConfirmClear(false);
    startTransition(async () => {
      addOptimistic("clear");
      try {
        const res = await clearChat({ spaceId });
        if (!res.ok) throw new Error(res.error);
        setConfirmed([]);
        setWorked({});
        setAnswerError(null);
        setHappyId(null);
        failed.current = null;
        toast({ tone: "success", title: "Chat cleared" });
      } catch {
        toast({ tone: "error", title: "Chat not cleared", description: "Check your connection and try again." });
      }
    });
  }

  // Regenerate is offered on the newest answer only (the server enforces it too).
  const lastUser = [...messages].reverse().find((m) => m.role === "user" && !m.edit && !m.local);
  const lastAnswerId = (() => {
    const last = messages.at(-1);
    return last?.role === "assistant" && !last.edit && !last.local && !last.id.startsWith("stopped-") ? last.id : null;
  })();

  return (
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden",
        big ? "bg-bg" : "rounded-card border border-border bg-surface/40",
      )}
    >
      {/* Header: title + expand / collapse + close */}
      <div className={cn("flex items-center gap-1 px-3 pt-2", big ? "sm:px-5" : "border-b border-border pb-2")}>
        <p className={cn("min-w-0 flex-1 truncate text-sm font-semibold text-fg-body", big && empty && "invisible")}>
          Chat · {spaceName}
        </p>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            disabled={busy}
            aria-label="Clear chat"
            title={busy ? "Stop the answer to clear the chat" : "Clear chat"}
            className="inline-flex size-11 items-center justify-center rounded-control text-fg-muted hover:bg-surface hover:text-fg disabled:pointer-events-none disabled:opacity-40 lg:size-9"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}
        {docked && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Collapse chat" : "Expand chat"}
            title={expanded ? "Collapse (Esc)" : "Expand"}
            className="inline-flex size-11 items-center justify-center rounded-control text-fg-muted hover:bg-surface hover:text-fg lg:size-9"
          >
            {expanded ? <Minimize2 className="size-4" aria-hidden /> : <Maximize2 className="size-4" aria-hidden />}
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close chat"
          className="inline-flex size-11 items-center justify-center rounded-control text-fg-muted hover:bg-surface hover:text-fg lg:size-9"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <Dialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear this chat?"
        description={`All messages in “${spaceName}” will be deleted. Your files, summaries and cards stay. This can't be undone.`}
        closeLabel="Cancel"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={clearAll}>
              Clear chat
            </Button>
          </>
        }
      >
        {null}
      </Dialog>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className={cn("relative min-h-0 flex-1 overflow-y-auto overscroll-contain", big ? "px-4 py-6 sm:px-8" : "px-3 py-4 sm:px-4")}
        aria-live="polite"
        aria-busy={busy}
      >
        {empty ? (
          <Welcome spaceName={spaceName} onPick={send} big={big} docTitle={doc?.title ?? null} />
        ) : (
          <ol className={cn("@container mx-auto flex flex-col gap-6", big ? "max-w-3xl" : "max-w-full")}>
            {messages.map((m) =>
              m.role === "user" ? (
                <UserBubble key={m.id} text={m.content} />
              ) : m.manage ? (
                <AssistantRow key={m.id} mood={m.manage.status === "applied" ? "happy" : "idle"} animated={m.manage.status === "applying"}>
                  <ManageCard
                    spaceId={spaceId}
                    manage={m.manage}
                    onChange={(next) => setConfirmed((c) => c.map((x) => (x.id === m.id ? { ...x, manage: next } : x)))}
                  />
                </AssistantRow>
              ) : m.edit ? (
                <AssistantRow
                  key={m.id}
                  mood={m.edit.status === "running" ? "writing" : m.edit.status === "error" ? "sad" : "idle"}
                  animated={m.edit.status === "running"}
                >
                  <EditStatus edit={m.edit} title={doc?.title ?? null} />
                </AssistantRow>
              ) : (
                <AssistantRow
                  key={m.id}
                  mood={m.id === happyId ? "happy" : "idle"}
                  // Only the newest answer's pal moves; older ones stay still.
                  animated={m.id === lastAnswerId}
                >
                  {worked[m.id] !== undefined && <Steps sources={m.sources} workedMs={worked[m.id]} />}
                  <AnswerText text={m.content} sources={m.sources} spaceId={spaceId} />
                  <SourceCards sources={m.sources} spaceId={spaceId} />
                  <MessageActions
                    getText={() => plainAnswer(m.content, (n) => m.sources.find((x) => x.n === n)?.page)}
                    onRegenerate={
                      m.id === lastAnswerId && lastUser
                        ? () => regenerate(lastUser.clientId ?? lastUser.id, lastUser.content)
                        : undefined
                    }
                    regenerateDisabled={busy}
                  />
                </AssistantRow>
              ),
            )}
            {answerError && !live && (
              <AssistantRow mood="sad" animated>
                <div role="alert" className="flex flex-col gap-3 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-start gap-2 text-sm text-fg-body">
                    <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
                    <span>Couldn&apos;t answer. {answerError.error}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => regenerate(answerError.clientId, answerError.message)}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 self-start rounded-control bg-surface-active px-3 text-sm font-semibold text-fg hover:bg-border-strong sm:self-auto lg:min-h-9"
                  >
                    <RotateCw aria-hidden className="size-3.5" />
                    Try again
                  </button>
                </div>
              </AssistantRow>
            )}
            {live && liveMood && (
              <AssistantRow mood={shownMood ?? liveMood} animated>
                {live.phase !== "waiting" && <Steps sources={live.sources} running={live.text ? "text" : live.phase} />}
                {live.text ? (
                  <AnswerText text={live.text} sources={live.sources ?? []} spaceId={spaceId} streaming />
                ) : live.phase === "search" ? (
                  <AiTypingIndicator label="Searching your files" icon="search" showElapsed />
                ) : live.phase === "write" ? (
                  <AiTypingIndicator label="Writing your answer" icon="write" showElapsed />
                ) : (
                  <span role="status" aria-label="Answering" className="flex min-h-7 items-center">
                    <TypingDots />
                  </span>
                )}
              </AssistantRow>
            )}
          </ol>
        )}
      </div>

      <div className={cn("relative", big ? "px-4 pb-4 sm:px-8 sm:pb-6" : "p-2 sm:p-3")}>
        {big && (
          // The reference's light rising from under the composer, in our accent.
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -bottom-24 h-72 bg-[radial-gradient(ellipse_45%_60%_at_50%_100%,rgb(83_33_158/0.55),transparent_70%)]"
            />
            {/* The vertical beam rising behind the box. */}
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-0 left-1/2 h-[140%] w-48 -translate-x-1/2 bg-[radial-gradient(ellipse_50%_100%_at_50%_100%,rgb(170_120_255/0.4),transparent_70%)] blur-2xl"
            />
          </>
        )}
        <div className={cn("relative mx-auto", big ? "max-w-[44rem]" : "max-w-full")}>
          <ChatComposer
            value={draft}
            onChange={setDraft}
            onSend={() => send(draft)}
            onStop={() => (live ? abort.current?.abort() : doc?.stop())}
            busy={busy}
            spaceName={spaceName}
            large={big}
            {...(doc
              ? {
                  chip: doc.selection ? `Your selection · ${doc.title}` : doc.title,
                  chipIcon: "doc" as const,
                  onChipClear: doc.selection && !busy ? doc.clearSelection : undefined,
                  placeholder: "Ask, or tell Vappi what to change…",
                  maxLength: EDIT_INSTRUCTION_MAX,
                }
              : {})}
          />
          <p className="mt-2 px-1 text-center text-[0.6875rem] text-fg-subtle">
            {doc
              ? "Vappi edits only with facts from your files. You can undo any change."
              : "Answers come only from your files. Check the linked pages."}
          </p>
        </div>
      </div>
    </div>
  );
}

/** The optimistic bubble and the confirmed one share an id; show it once. */
function dedupe(list: ChatMessageView[]) {
  const seen = new Set<string>();
  return list.filter((m) => !seen.has(m.id) && seen.add(m.id));
}

async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) yield JSON.parse(line) as ChatEvent;
    }
  }
}

/** Empty chat. Expanded: the reference's big centered greeting. */
function Welcome({
  spaceName,
  onPick,
  big,
  docTitle,
}: {
  spaceName: string;
  onPick: (q: string) => void;
  big: boolean;
  /** The open creation (Create editor). */
  docTitle: string | null;
}) {
  const onDoc = docTitle !== null;
  const examples = onDoc ? DOC_EXAMPLES : EXAMPLES;
  // Says hi, then settles and watches the pointer.
  const [greeting, setGreeting] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setGreeting(false), 1700);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center gap-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <VappiPal mood={greeting ? "greeting" : "idle"} size={big ? 96 : 72} followPointer={!greeting} label="Vappi" className="mb-2" />
        <p className="text-xs text-fg-subtle">Vappi · {spaceName}</p>
        <p
          className={cn(
            "font-normal tracking-tight text-fg wrap-anywhere",
            big ? "max-w-md text-3xl leading-tight sm:text-[2.5rem]" : "text-xl leading-snug",
          )}
        >
          {docTitle ? `Tell me what to change in “${docTitle}”` : `Ask anything about ${spaceName}`}
        </p>
        <p className={cn("text-fg-muted", big ? "max-w-sm text-sm" : "text-xs")}>
          {onDoc
            ? "I'll edit it live while you watch, or answer questions about it. Select text first to change just that part."
            : "Answers come only from your files, with links to the pages they use."}
        </p>
      </div>
      <ul className={cn("flex w-full flex-col gap-2", big && "sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center")}>
        {examples.map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => onPick(q)}
              className="min-h-11 w-full rounded-pill border border-border bg-surface px-4 text-sm text-fg-body transition-colors hover:border-border-strong hover:text-fg lg:min-h-9"
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <li className="group flex flex-col items-end gap-1">
      <p dir="auto" className="max-w-[85%] rounded-card rounded-br-md bg-surface-active px-4 py-2.5 text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-fg wrap-anywhere">
        {text}
      </p>
      <div className="lg:opacity-0 lg:transition-opacity lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
        <MessageActions getText={() => text} align="end" />
      </div>
    </li>
  );
}

/** Assistant message: a small Vappi avatar and name, the content beside it (above it on phones). */
function AssistantRow({
  children,
  mood = "idle",
  animated = false,
}: {
  children: ReactNode;
  mood?: PalMood;
  animated?: boolean;
}) {
  return (
    <li className="flex flex-col gap-2 @xl:flex-row @xl:gap-3">
      <span className="flex items-center gap-2 @xl:items-start">
        <VappiPal mood={mood} size={30} animated={animated} label={false} />
        <span className="text-xs font-semibold text-fg-muted @xl:hidden">Vappi</span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <span className="hidden text-xs font-semibold text-fg-muted @xl:block @xl:leading-7">Vappi</span>
        {children}
      </div>
    </li>
  );
}

/** The agent's trace: searched → found pages → wrote. Folds once the answer is done. */
function Steps({
  sources,
  running,
  workedMs,
}: {
  sources: ChatSource[] | null;
  /** While answering: the server's current phase ("text" once the answer streams). */
  running?: "search" | "write" | "text";
  workedMs?: number;
}) {
  const [open, setOpen] = useState(false);
  const pages = sources ? uniquePages(sources) : [];
  const found = sources
    ? sources.length === 0
      ? "No matching passages"
      : `Found ${sources.length} passage${sources.length === 1 ? "" : "s"} · ${pages.length} page${pages.length === 1 ? "" : "s"}`
    : null;

  if (running) {
    return (
      <ul className="flex flex-col gap-1.5 text-xs text-fg-muted">
        <StepRow done={sources !== null} label={sources ? "Searched your files" : "Searching your files"} />
        {found && <StepRow done label={found} />}
        {running === "text" && <StepRow done={false} label="Writing" />}
      </ul>
    );
  }

  return (
    <div className="text-xs text-fg-subtle">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex min-h-11 items-center gap-1.5 hover:text-fg-muted lg:min-h-0"
      >
        <Search aria-hidden className="size-3.5" />
        Worked for {Math.max(1, Math.round((workedMs ?? 0) / 1000))}s
        <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="mt-1 flex flex-col gap-1.5 border-s border-border ps-3 animate-fade-in">
          <StepRow done label="Searched your files" />
          {found && <StepRow done label={found} />}
          {pages.length > 0 && <li className="wrap-anywhere">{pages.map((p) => p.label).join(" · ")}</li>}
        </ul>
      )}
    </div>
  );
}

function StepRow({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {done ? <Check aria-hidden className="size-3.5 text-success" /> : <TypingDots />}
      <span>{label}</span>
    </li>
  );
}

function uniquePages(sources: ChatSource[]) {
  const seen = new Map<string, { label: string }>();
  for (const s of sources) {
    const k = `${s.documentId}:${s.page}`;
    if (!seen.has(k)) seen.set(k, { label: `${s.fileType === "PPTX" ? "Slide" : "Page"} ${s.page}, ${s.title}` });
  }
  return [...seen.values()];
}


/** A Create editor turn in the chat: what Vappi is doing to the document. */
function EditStatus({ edit, title }: { edit: NonNullable<ChatMessageView["edit"]>; title: string | null }) {
  const part = edit.scope === "selection" ? "your selection" : "the document";
  if (edit.status === "running") return <AiTypingIndicator label={`Editing ${part}`} icon="write" showElapsed />;
  if (edit.status === "error")
    return (
      <p role="alert" className="flex items-start gap-2 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-fg-body">
        <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
        <span>Couldn&apos;t edit. {edit.error}</span>
      </p>
    );
  if (edit.status === "info") return <p className="text-[0.9375rem] leading-relaxed text-fg-body">{edit.reply}</p>;
  return (
    <p className="text-[0.9375rem] leading-relaxed text-fg-body">
      {edit.status === "stopped" ? "Stopped. " : edit.reply ? `${edit.reply} ` : `Done. I changed ${part}${title ? ` in “${title}”` : ""}. `}
      <span className="text-fg-muted">Keep it or undo it in the document.</span>
    </p>
  );
}
