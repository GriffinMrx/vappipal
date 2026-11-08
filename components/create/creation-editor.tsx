"use client";

import { AiIcon } from "@/components/ui/ai-icon";
import { SourceCards } from "@/components/chat/answer-text";
import { useChatPanel } from "@/components/chat/chat-panel";
import { palStore } from "@/components/pal/pal-store";
import { VappiPal, type PalKick, type PalMood } from "@/components/pal/vappi-pal";
import { ActionMenu } from "@/components/ui/action-menu";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { ChatSource } from "@/lib/chat/types";
import { cn } from "@/lib/cn";
import {
  deleteCreation,
  duplicateCreation,
  renameCreation,
  saveCreationContent,
  setCreationLook,
} from "@/lib/creations/actions";
import { contentExtensions } from "@/lib/creations/extensions";
import { splitTitle, stripCitations, titleFrom } from "@/lib/creations/markdown-text";
import {
  BANNERS,
  TYPE_INFO,
  type BannerKey,
  type CreationEvent,
  type CreationType,
  type CreationView,
} from "@/lib/creations/types";
import type { JSONContent } from "@tiptap/core";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { Mapping } from "@tiptap/pm/transform";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { Check, CircleAlert, Copy, Ellipsis, Files, Loader2, RotateCw, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { aiRangeKey, AiRangeHighlight, type AiRange } from "./ai-range";
import { isPlain, resolvePlan, type MetaStep, type PlanStep, type Selection } from "./apply-plan";
import { CaretPal } from "./caret-pal";
import { reactionFor } from "./reactions";
import { editorBridge, type EditHistoryItem, type EditOutcome } from "./editor-bridge";
import { createTypewriter, type Typewriter } from "./typewriter";
import { WRITING_SPEED_KEYS, WRITING_SPEEDS, type WritingSpeed } from "@/lib/settings/writing-speed";
import { useWritingSpeed, writingSpeedStore } from "@/components/settings/writing-speed-store";
import { EditorToolbar } from "./editor-toolbar";
import { BannerButton, EmojiButton, InlineTitle } from "./page-header";

type Mode = "idle" | "writing" | "editing";
type SaveState = "saved" | "saving" | "retrying";

const SAVE_AFTER_MS = 800;
const draftKey = (id: string) => `vappi.creation.${id}`;

/** Reads an NDJSON response line by line. */
async function* readEvents(res: Response): AsyncGenerator<CreationEvent> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) yield JSON.parse(line) as CreationEvent;
    }
  }
}

const routeError = (status: number, error?: string) =>
  status === 403 && error === "limit"
    ? "You've used this week's free creations. Upgrade to Pro for unlimited."
    : status === 403 && error === "pro"
      ? "Vappi's AI editing is a Pro feature. Upgrade to use it."
    : status === 409
      ? "This Space has no ready files yet. Upload a file first."
      : status === 429
        ? "That's a lot of edits this hour. Try again a bit later."
        : status === 401
          ? "You're signed out. Sign in again."
          : "Something went wrong. Try again.";

type Before = { doc: JSONContent; title: string; icon: string | null; banner: BannerKey | null };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const viewKey = (id: string) => `vappi.creation.view.${id}`;

/** Position right after the last character of the last non-empty textblock. */
function lastTextEnd(doc: PMNode): number {
  let end = doc.content.size;
  doc.descendants((node, pos) => {
    if (node.isTextblock) {
      if (node.content.size > 0) end = pos + 1 + node.content.size;
      return false;
    }
    return true;
  });
  return end;
}

/** The inline content of the first textblock in parsed Markdown (for word-level replacements). */
function inlineNodes(json: JSONContent): JSONContent[] {
  const kids = json.content ?? [];
  if (kids.some((c) => c.type === "text" || c.type === "hardBreak")) return kids;
  for (const c of kids) {
    const found = inlineNodes(c);
    if (found.length) return found;
  }
  return [];
}

export function CreationEditor({
  spaceId,
  initial,
  start,
  canUseAi,
  speed,
  speedAt,
}: {
  spaceId: string;
  /** Pro: Vappi's AI editing (side chat, selection button, Continue writing). */
  canUseAi: boolean;
  /** Settings → writing speed (server value) and when the user record last changed. */
  speed: WritingSpeed;
  speedAt: number;
  /** An existing creation, or null while a new one is being made. */
  initial: CreationView | null;
  /** New creation (or regenerate): what to ask Vappi to write. */
  start: { type: CreationType; instruction: string | null; replaceId?: string } | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [id, setId] = useState<string | null>(initial?.id ?? null);
  const [type] = useState<CreationType>(initial?.type ?? start?.type ?? "NOTES");
  const [title, setTitle] = useState(initial?.title ?? TYPE_INFO[type].label);
  const [icon, setIcon] = useState<string | null>(initial?.icon ?? TYPE_INFO[type].emoji);
  const [banner, setBanner] = useState<BannerKey | null>(initial?.banner ?? null);
  const [sources, setSources] = useState<ChatSource[]>(initial?.sources ?? []);
  const [mode, setMode] = useState<Mode>(start ? "writing" : "idle");
  const [phase, setPhase] = useState<"search" | "write">("search");
  const [failed, setFailed] = useState<string | null>(initial?.status === "FAILED" ? "This creation didn't finish." : null);
  const [save, setSave] = useState<SaveState>("saved");
  const [review, setReview] = useState<{ before: Before } | null>(null);
  /** Left mid-writing last time: offer to continue. */
  const [unfinished, setUnfinished] = useState(initial?.status === "WRITING" && !start);
  const [caretMood, setCaretMood] = useState<PalMood>("writing");
  const [kick, setKick] = useState<PalKick>({ n: 0, kind: "hop" });
  const lastKick = useRef(0);
  const moodTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const leaving = useRef(false);
  /** The floating "Ask Vappi" button over a selection (position in the document box). */
  const [selBtn, setSelBtn] = useState<{ x: number; y: number } | null>(null);
  const [selText, setSelText] = useState<string | null>(null);
  const typing = useRef<Typewriter | null>(null);
  const chatPanel = useChatPanel();
  // Live: a change in Settings (this tab or another) applies at once, even mid-typing.
  const liveSpeed = useWritingSpeed(speed, speedAt);
  const paceRef = useRef(WRITING_SPEEDS[speed].pace);
  useEffect(() => {
    paceRef.current = WRITING_SPEEDS[canUseAi ? liveSpeed : "NORMAL"].pace;
  }, [liveSpeed, canUseAi]);
  const pace = () => paceRef.current;
  const canUseAiRef = useRef(canUseAi);
  useEffect(() => {
    canUseAiRef.current = canUseAi;
  }, [canUseAi]);
  /** The last speed the server told us (the truth across devices and addresses). */
  const serverSpeed = useRef<WritingSpeed | null>(null);
  /**
   * The server says the speed is `s`. At the start of a run it always applies;
   * while typing it applies only when it changed (a change made on another device),
   * so it never undoes a newer change made in this browser.
   */
  const fromServer = (s: WritingSpeed, start: boolean) => {
    if (!start && serverSpeed.current === s) return;
    serverSpeed.current = s;
    const use = canUseAiRef.current ? s : "NORMAL";
    paceRef.current = WRITING_SPEEDS[use].pace;
    if (canUseAiRef.current) writingSpeedStore.adopt(s); // other tabs on this address follow too
  };
  /** While Vappi types, re-check the speed every 3 s (a change from a phone applies mid-typing). */
  const watchSpeed = () => {
    if (!canUseAiRef.current) return () => {};
    let busy = false;
    const t = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        const r = await fetch("/api/settings/writing-speed", { cache: "no-store" });
        const v = r.ok ? ((await r.json()) as { speed?: string }).speed : undefined;
        if (v && (WRITING_SPEED_KEYS as string[]).includes(v)) fromServer(v as WritingSpeed, false);
      } catch {
        /* offline: keep the current pace */
      } finally {
        busy = false;
      }
    }, 3000);
    return () => clearInterval(t);
  };
  const [caret, setCaret] = useState<{ x: number; y: number } | null>(null);
  const [heading, setHeading] = useState<{ from: number; to: number; text: string; top: number; left: number; width: number; level: number } | null>(null);
  const [confirm, setConfirm] = useState<"delete" | "regenerate" | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(id);
  const modeRef = useRef(mode);
  useEffect(() => {
    idRef.current = id;
    modeRef.current = mode;
  }, [id, mode]);

  // ── Autosave (optimistic: the screen is the state; a local draft keeps it safe) ──
  const saveNow = useCallback(async (editor: Editor) => {
    const cid = idRef.current;
    if (!cid) return;
    const doc = editor.getJSON();
    try {
      localStorage.setItem(draftKey(cid), JSON.stringify({ doc, at: Date.now() }));
    } catch {
      /* storage full: the server save still runs */
    }
    setSave("saving");
    try {
      const res = await saveCreationContent({ id: cid, content: JSON.stringify(doc) });
      if (!res.ok) throw new Error(res.error);
      localStorage.removeItem(draftKey(cid));
      setSave("saved");
    } catch {
      setSave("retrying"); // retried below (every 5 s, and when back online)
    }
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      ...contentExtensions,
      Markdown,
      AiRangeHighlight,
      Placeholder.configure({ placeholder: "Start writing, or ask Vappi…" }),
    ],
    content: initial?.content ? (initial.content as JSONContent) : (initial?.markdown ?? ""),
    contentType: initial?.content ? "json" : "markdown",
    editable: !start,
    // Each paragraph/heading picks its own direction (Arabic right-to-left, English left-to-right).
    textDirection: "auto",
    editorProps: {
      attributes: { class: "vappi-doc focus:outline-none", "aria-label": "Document" },
      // Double-click a heading → rename it inline.
      handleDoubleClick(view, pos) {
        if (modeRef.current !== "idle") return false;
        const $p = view.state.doc.resolve(pos);
        const node = $p.parent;
        if (node.type.name !== "heading") return false;
        const from = $p.start();
        const el = view.nodeDOM($p.before()) as HTMLElement | null;
        const box = wrap.current?.getBoundingClientRect();
        const r = el?.getBoundingClientRect();
        if (!el || !box || !r) return false;
        setHeading({
          from,
          to: from + node.content.size,
          text: node.textContent,
          top: r.top - box.top,
          left: r.left - box.left,
          width: r.width,
          level: node.attrs.level as number,
        });
        return true;
      },
    },
    onUpdate({ editor: e, transaction }) {
      if (modeRef.current !== "idle" || transaction.getMeta("vappi-ai")) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSave("saving");
      saveTimer.current = setTimeout(() => void saveNow(e), SAVE_AFTER_MS);
    },
  });

  // A local draft newer than the server copy (e.g. saved offline) wins, then saves.
  useEffect(() => {
    if (!editor || !initial || start) return;
    try {
      const raw = localStorage.getItem(draftKey(initial.id));
      if (!raw) return;
      const draft = JSON.parse(raw) as { doc: JSONContent; at: number };
      if (draft.at > Date.parse(initial.updatedAt)) {
        editor.commands.setContent(draft.doc, { emitUpdate: false });
        const t = setTimeout(() => void saveNow(editor), 0);
        return () => clearTimeout(t);
      }
      localStorage.removeItem(draftKey(initial.id));
    } catch {
      /* ignore a broken draft */
    }
  }, [editor, initial, start, saveNow]);

  // Retry a failed save every 5 s, and as soon as we're back online.
  useEffect(() => {
    if (!editor || save !== "retrying") return;
    const retry = () => void saveNow(editor);
    const t = setTimeout(retry, 5000);
    window.addEventListener("online", retry);
    return () => {
      clearTimeout(t);
      window.removeEventListener("online", retry);
    };
  }, [editor, save, saveNow]);

  /** Put the pal caret at a document position (or hide it). */
  const moveCaret = useCallback(
    (pos: number | null) => {
      if (!editor || pos === null || !wrap.current) return setCaret(null);
      try {
        const doc = editor.state.doc;
        // Snap to a real text spot at or before `pos`: at a block boundary ProseMirror
        // reports the block's right edge, which left the pal stuck in the margin.
        const at = TextSelection.near(doc.resolve(Math.max(0, Math.min(pos, doc.content.size))), -1).head;
        const c = editor.view.coordsAtPos(at);
        const box = wrap.current.getBoundingClientRect();
        setCaret({ x: c.right - box.left, y: c.top - box.top });
      } catch {
        setCaret(null);
      }
    },
    [editor],
  );

  const aiMeta = (range: AiRange) => editor?.view.dispatch(editor.state.tr.setMeta(aiRangeKey, range).setMeta("vappi-ai", true));

  /** A reaction from the riding pal (and a short mood, e.g. happy at "!"). */
  const kickPal = (kind: PalKick["kind"], mood?: PalMood) => {
    lastKick.current = performance.now();
    setKick((k) => ({ n: k.n + 1, kind }));
    if (mood) {
      setCaretMood(mood);
      clearTimeout(moodTimer.current);
      moodTimer.current = setTimeout(() => setCaretMood("writing"), 900);
    }
  };
  /** React to the words just written (not more than ~3 times a second). */
  const reactTo = (chunk: string) => {
    if (performance.now() - lastKick.current < 250) return;
    const r = reactionFor(chunk);
    if (r) kickPal(r.kick ?? "nod", r.mood);
    // Otherwise a small nod for each finished word, so it reads along.
    else if (/\s/.test(chunk)) kickPal("nod");
  };

  // ── Vappi writes a new creation (or regenerates) live ──
  const started = useRef(false);
  useEffect(() => {
    if (!editor || !start || started.current) return;
    started.current = true;
    // A refresh while Vappi was writing: open the creation it already started, don't write a second one.
    const startKey = `vappi.creating.${window.location.pathname}${window.location.search}`;
    const already = window.sessionStorage.getItem(startKey);
    if (already) {
      router.replace(`/spaces/${spaceId}/create/${already}`);
      return;
    }
    const ctrl = new AbortController();
    abort.current = ctrl;
    palStore.set("thinking");
    (async () => {
      let acc = "";
      let shown = "";
      const render = (text: string) => {
        reactTo(text.slice(shown.length));
        shown = text;
        // The "# Title" line becomes the page title; the rest is the document.
        const { title: heading, body } = splitTitle(stripCitations(text));
        editor.commands.setContent(body, { contentType: "markdown", emitUpdate: false });
        // The end of the last line with text (a trailing line break leaves an empty paragraph).
        const end = lastTextEnd(editor.state.doc);
        aiMeta({ from: Math.max(0, end - 1), to: end, className: "ai-writing" });
        moveCaret(end);
        const t = heading ?? (start.type === "EMAIL" ? titleFrom(body) : null);
        if (t) setTitle(t);
      };
      // Text arrives in bursts; the typewriter reveals it at a calm pace.
      const tw = createTypewriter((text) => render(text), pace);
      typing.current = tw;
      const unwatch = watchSpeed();
      try {
        const res = await fetch(`/api/spaces/${spaceId}/creations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: start.type, instruction: start.instruction ?? undefined, replaceId: start.replaceId }),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(routeError(res.status, err.error));
        }
        for await (const e of readEvents(res)) {
          if (e.t === "speed") {
            fromServer(e.speed, true);
          } else if (e.t === "created") {
            setId(e.id);
            idRef.current = e.id;
            // The address becomes /create/<id> only once Vappi has finished (see finally): swapping
            // it now lets the router re-render the page mid-writing, which restarted the editor.
            try {
              window.sessionStorage.setItem(startKey, e.id);
            } catch {
              /* private mode: a refresh would just start again */
            }
          } else if (e.t === "step") {
            palStore.set("searching");
          } else if (e.t === "found") {
            setPhase("write");
          } else if (e.t === "delta") {
            if (!acc) palStore.set("writing");
            acc += e.text;
            tw.push(e.text);
          } else if (e.t === "done") {
            await tw.finish();
            if (ctrl.signal.aborted) break;
            // The saved version (title and citations already taken out).
            editor.commands.setContent(e.markdown, { contentType: "markdown", emitUpdate: false });
            if (e.title) setTitle(e.title);
            setSources(e.sources);
            palStore.set("happy", 1600);
          } else if (e.t === "error") {
            throw new Error(e.message);
          }
        }
      } catch (err) {
        if (!ctrl.signal.aborted) {
          palStore.set("sad", 2500);
          setFailed(err instanceof Error ? err.message : "Something went wrong.");
          if (!acc) setTitle(TYPE_INFO[start.type].label);
        } else palStore.set("idle");
      } finally {
        unwatch();
        tw.stop();
        typing.current = null;
        abort.current = null;
        aiMeta(null);
        moveCaret(null);
        editor.setEditable(true);
        setMode("idle");
        // Stop keeps what was shown (saving it replaces the server's fuller copy).
        // Leaving the page doesn't: the server keeps its copy as "unfinished".
        const cid = idRef.current;
        const swapUrl = () => {
          if (!leaving.current && cid) window.history.replaceState(null, "", `/spaces/${spaceId}/create/${cid}`);
        };
        if (ctrl.signal.aborted && !leaving.current && cid && shown) void saveNow(editor).then(swapUrl);
        else swapUrl();
      }
    })();
    // Runs once per mount; `start` is fixed for this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => {
    // Reset on every mount: React's development double-mount runs this cleanup once
    // on purpose, which otherwise left the page thinking the user had already left.
    leaving.current = false;
    return () => {
      leaving.current = true;
      abort.current?.abort();
      typing.current?.stop();
    };
  }, []);

  // ── Come back to where you were: scroll position and cursor ──
  useEffect(() => {
    if (!editor || !initial || start) return;
    try {
      const v = JSON.parse(localStorage.getItem(viewKey(initial.id)) ?? "null") as { y: number; from: number; to: number } | null;
      if (!v) return;
      const max = editor.state.doc.content.size;
      editor.commands.setTextSelection({ from: Math.min(v.from, max), to: Math.min(v.to, max) });
      // A keyboard pops up on phones when the editor takes focus: only focus with a mouse.
      if (window.matchMedia("(pointer: fine)").matches) editor.commands.focus(null, { scrollIntoView: false });
      const t = setTimeout(() => window.scrollTo({ top: v.y }), 80);
      return () => clearTimeout(t);
    } catch {
      /* nothing saved */
    }
  }, [editor, initial, start]);
  useEffect(() => {
    if (!editor || !id) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const remember = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        try {
          const { from, to } = editor.state.selection;
          localStorage.setItem(viewKey(id), JSON.stringify({ y: Math.round(window.scrollY), from, to }));
        } catch {
          /* storage full */
        }
      }, 300);
    };
    window.addEventListener("scroll", remember, { passive: true });
    editor.on("selectionUpdate", remember);
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", remember);
      editor.off("selectionUpdate", remember);
    };
  }, [editor, id]);

  // ── Vappi edits live, asked from the side chat: a plan of small, exact changes ──
  async function runEdit(
    instruction: string,
    auto: boolean,
    onWorking?: () => void,
    history: EditHistoryItem[] = [],
  ): Promise<EditOutcome> {
    if (!editor || !id) return { kind: "error", message: "Wait until the document is ready." };
    if (modeRef.current !== "idle") return { kind: "error", message: "Vappi is already working on it." };
    const md = editor.markdown;
    if (!md) return { kind: "error", message: "Something went wrong. Try again." };
    const doc0 = editor.state.doc;
    const before: Before = { doc: editor.getJSON(), title, icon, banner };
    const blocks: string[] = [];
    doc0.forEach((node) => blocks.push(md.serialize({ type: "doc", content: [node.toJSON() as JSONContent] })));

    // The highlighted text, exactly (words inside one block stay words).
    const { from: sFrom, to: sTo, empty } = editor.state.selection;
    let sel: Selection = null;
    let selection: { text: string; block: number; inline: boolean } | null = null;
    if (!empty) {
      const $a = doc0.resolve(sFrom);
      const $b = doc0.resolve(sTo);
      const inline = $a.parent === $b.parent && $a.parent.isTextblock;
      const text = doc0.textBetween(sFrom, sTo, "\n").trim();
      if (text) {
        sel = { from: sFrom, to: sTo, inline };
        selection = { text: text.slice(0, 20_000), block: $a.index(0) + 1, inline };
      }
    }
    const scope = sel ? ("selection" as const) : ("document" as const);

    modeRef.current = "editing";
    setMode("editing");
    setReview(null);
    editor.setEditable(false);
    if (sel) {
      aiMeta({ from: sel.from, to: sel.to, className: "ai-target", inline: sel.inline });
      moveCaret(sel.from);
    } else moveCaret(1); // waits at the top of the page while it thinks
    palStore.set("thinking");
    setCaretMood("thinking");
    const ctrl = new AbortController();
    abort.current = ctrl;
    let changed = false;
    let outcome: EditOutcome = { kind: "error", message: "Something went wrong. Try again." };

    /** Bring a document position into view (below the sticky bars) if it's off screen. */
    const reveal = (pos: number) => {
      try {
        const c = editor.view.coordsAtPos(Math.min(pos, editor.state.doc.content.size));
        if (c.top < 190 || c.bottom > window.innerHeight - 90)
          window.scrollTo({ top: window.scrollY + c.top - window.innerHeight / 3, behavior: "smooth" });
      } catch {
        /* position gone: ignore */
      }
    };

    /** Page changes (title types in; icon and banner pop in). */
    const playMeta = async (m: MetaStep) => {
      if (m.kind === "title") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        const tw = createTypewriter((shown) => setTitle(shown || " "), pace);
        typing.current = tw;
        tw.push(m.title);
        await tw.finish();
        rename(m.title);
      } else if (m.kind === "icon") {
        look({ icon: m.emoji });
      } else look({ banner: m.banner as BannerKey | null });
      kickPal("hop", "happy");
      await sleep(450);
    };

    /** One change, typed in at the calm pace, touching only its own range. */
    const playStep = async (step: PlanStep, mapping: Mapping): Promise<boolean> => {
      const from = mapping.map(step.from, 1);
      let end = Math.max(from, mapping.map(step.to, 1));
      const inline = step.kind === "inline";
      reveal(from);
      if (end > from) {
        // Show what's about to change for a moment.
        aiMeta({ from, to: end, className: "ai-target", inline });
        moveCaret(inline ? end : from + 1);
        await sleep(380);
      } else moveCaret(from);
      let ok = true;
      let prev = "";
      const write = (text: string) => {
        const tr = editor.state.tr;
        try {
          if (inline) {
            if (!text) tr.delete(from, end);
            else if (isPlain(text)) tr.insertText(text, from, end); // keeps the existing bold/italic
            else tr.replaceWith(from, end, inlineNodes(md.parse(text)).map((j) => editor.schema.nodeFromJSON(j)));
          } else {
            const parsed = md.parse(text);
            const json = step.kind === "items" ? (parsed.content?.[0]?.content ?? []) : (parsed.content ?? []);
            tr.replaceWith(from, end, json.map((j) => editor.schema.nodeFromJSON(j)));
          }
        } catch {
          ok = false;
          return;
        }
        tr.setMeta("vappi-ai", true);
        const size = editor.state.doc.content.size;
        editor.view.dispatch(tr);
        mapping.appendMapping(tr.mapping);
        end += editor.state.doc.content.size - size;
        changed = true;
        aiMeta({ from, to: end, className: "ai-writing", inline });
        moveCaret(inline ? end : Math.max(from, end - 1));
      };
      const tw = createTypewriter((shown) => {
        if (!ok) return;
        write(shown);
        reactTo(shown.slice(prev.length));
        prev = shown;
      }, pace);
      typing.current = tw;
      tw.push(step.text);
      if (!step.text) {
        kickPal("wiggle");
        write("");
      }
      await tw.finish();
      return ok;
    };

    const unwatch = watchSpeed();
    try {
      const res = await fetch(`/api/spaces/${spaceId}/creations/${id}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction, blocks, page: { title, icon, banner }, selection, auto, history }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(routeError(res.status, err.error));
      }
      let plan: Extract<CreationEvent, { t: "plan" }> | null = null;
      for await (const e of readEvents(res)) {
        if (e.t === "ask") {
          outcome = { kind: "ask" };
          return outcome;
        }
        if (e.t === "speed") fromServer(e.speed, true);
        else if (e.t === "step") {
          palStore.set("searching");
          setCaretMood("searching");
          onWorking?.();
        } else if (e.t === "found") {
          palStore.set("thinking");
          setCaretMood("thinking");
        } else if (e.t === "plan") plan = e;
        else if (e.t === "error") throw new Error(e.message);
      }
      if (ctrl.signal.aborted) throw new DOMException("Stopped", "AbortError");
      if (!plan) throw new Error("Vappi didn't answer. Try again.");

      const { steps, meta, skipped } = resolvePlan(editor.state.doc, plan.ops, sel);
      aiMeta(null);
      palStore.set("writing");
      setCaretMood("writing");
      // Page changes first (they're at the top), then the text from top to bottom.
      for (const m of meta) {
        if (ctrl.signal.aborted) break;
        await playMeta(m);
        changed = true;
      }
      const mapping = new Mapping();
      let placed = 0;
      for (const step of steps) {
        if (ctrl.signal.aborted) break;
        if (await playStep(step, mapping)) placed++;
      }
      if (ctrl.signal.aborted) throw new DOMException("Stopped", "AbortError");
      if (plan.sources.length) {
        const add = plan.sources;
        setSources((prevSources) => {
          const k = (s: ChatSource) => `${s.documentId}:${s.page}`;
          const seen = new Set(prevSources.map(k));
          return [...prevSources, ...add.filter((s) => !seen.has(k(s)))];
        });
      }
      const missed = skipped + (steps.length - placed);
      const note = missed ? ` (${missed} change${missed === 1 ? "" : "s"} couldn't be placed.)` : "";
      if (!changed) {
        outcome = { kind: "info", reply: (plan.reply || "I didn't find anything to change.") + note };
        palStore.set("idle");
      } else {
        setReview({ before });
        outcome = { kind: "edited", scope, reply: (plan.reply || "Done.") + note };
        palStore.set("happy", 1600);
      }
    } catch (err) {
      if (ctrl.signal.aborted) {
        // Stop keeps what was changed so far (Undo brings back the original).
        palStore.set("idle");
        if (changed) setReview({ before });
        outcome = { kind: "stopped" };
      } else {
        if (changed) editor.commands.setContent(before.doc, { emitUpdate: false });
        palStore.set("sad", 2500);
        outcome = { kind: "error", message: err instanceof Error ? err.message : "Something went wrong. Try again." };
      }
    } finally {
      unwatch();
      typing.current?.stop();
      typing.current = null;
      abort.current = null;
      aiMeta(null);
      moveCaret(null);
      setCaretMood("writing");
      editor.setEditable(true);
      modeRef.current = "idle";
      setMode("idle");
      if (outcome.kind === "ask") palStore.set("idle");
      else if (changed) void saveNow(editor);
    }
    return outcome;
  }

  /** Undo an AI edit: the text, and the title / icon / banner it changed. */
  const restore = (b: Before) => {
    editor?.commands.setContent(b.doc);
    if (b.title !== title) rename(b.title);
    if (b.icon !== icon || b.banner !== banner) look({ icon: b.icon, banner: b.banner });
  };

  /** Finish a creation that stopped when the user left mid-writing. */
  const continueWriting = async () => {
    if (!editor) return;
    setUnfinished(false);
    editor.commands.setTextSelection(editor.state.doc.content.size);
    const o = await runEdit(
      "Continue writing this page from exactly where it stops. Keep everything already written exactly as it is, finish any cut-off sentence, and add the missing rest so the page is complete.",
      false,
    );
    if (o.kind === "error") {
      setUnfinished(true);
      toast({ tone: "error", title: "Couldn't continue", description: o.message });
    }
  };

  const stopAi = () => {
    abort.current?.abort();
    typing.current?.stop();
  };

  // ── Selection: the floating "Ask Vappi" button, and a tint while the chat has focus ──
  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const { from, to, empty } = editor.state.selection;
      if (empty) {
        setSelText(null);
        setSelBtn(null);
        return;
      }
      const text = editor.state.doc.textBetween(from, to, " ").replace(/\s+/g, " ").trim();
      setSelText(text ? (text.length > 60 ? `${text.slice(0, 60)}…` : text) : null);
      if (!canUseAi || !editor.isFocused || modeRef.current !== "idle" || !idRef.current || !wrap.current) return setSelBtn(null);
      try {
        const box = wrap.current.getBoundingClientRect();
        const a = editor.view.coordsAtPos(from);
        const b = editor.view.coordsAtPos(to);
        const top = Math.min(a.top, b.top) - box.top;
        const x = a.top === b.top ? (a.left + b.right) / 2 - box.left : a.left - box.left;
        setSelBtn({ x: Math.max(56, Math.min(x, box.width - 56)), y: Math.max(0, top - 46) });
      } catch {
        setSelBtn(null);
      }
    };
    const onBlur = () => {
      setSelBtn(null);
      if (modeRef.current !== "idle" || editor.state.selection.empty) return;
      const { from, to } = editor.state.selection;
      aiMeta({ from, to, className: "ai-picked", inline: true });
    };
    const onFocus = () => {
      if (modeRef.current === "idle") aiMeta(null);
      sync();
    };
    editor.on("selectionUpdate", sync);
    editor.on("focus", onFocus);
    editor.on("blur", onBlur);
    return () => {
      editor.off("selectionUpdate", sync);
      editor.off("focus", onFocus);
      editor.off("blur", onBlur);
    };
    // aiMeta only reads the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  /** Open the side chat and put the cursor in it. */
  const openChat = () => {
    setSelBtn(null);
    chatPanel.setOpen(true);
    setTimeout(() => document.querySelector<HTMLTextAreaElement>("#chat-input")?.focus(), 60);
  };

  // ── Publish this document to the side chat ──
  const runEditRef = useRef(runEdit);
  const stopRef = useRef(stopAi);
  useEffect(() => {
    runEditRef.current = runEdit;
    stopRef.current = stopAi;
  });
  useEffect(() => {
    if (!editor || !id || !canUseAi) return;
    editorBridge.set({
      id,
      title,
      selection: selText,
      busy: mode !== "idle",
      edit: (instruction, auto, onWorking, history) => runEditRef.current(instruction, auto, onWorking, history),
      stop: () => stopRef.current(),
      markdown: () => editor.markdown?.serialize(editor.getJSON()) ?? editor.getText(),
      clearSelection: () => {
        editor.commands.setTextSelection(editor.state.selection.to);
        editor.view.dispatch(editor.state.tr.setMeta(aiRangeKey, null));
      },
    });
  }, [editor, id, title, selText, mode, canUseAi]);
  useEffect(() => () => editorBridge.set(null), []);
  // ── Header actions (optimistic) ──
  const rename = (next: string) => {
    if (!id) return;
    const prev = title;
    setTitle(next);
    startTransition(async () => {
      const res = await renameCreation({ id, title: next }).catch(() => ({ ok: false as const, error: "Check your connection and try again." }));
      if (!res.ok) {
        setTitle(prev);
        toast({ tone: "error", title: "Not renamed", description: res.error });
      }
    });
  };
  const look = (patch: { icon?: string | null; banner?: BannerKey | null }) => {
    if (!id) return;
    const prev = { icon, banner };
    if (patch.icon !== undefined) setIcon(patch.icon);
    if (patch.banner !== undefined) setBanner(patch.banner);
    startTransition(async () => {
      const res = await setCreationLook({ id, ...patch }).catch(() => ({ ok: false as const, error: "" }));
      if (!res.ok) {
        setIcon(prev.icon);
        setBanner(prev.banner);
        toast({ tone: "error", title: "Not saved", description: "Check your connection and try again." });
      }
    });
  };
  const commitHeading = (text: string | null) => {
    const h = heading;
    setHeading(null);
    if (!editor || !h || text === null) return;
    const next = text.trim();
    if (!next || next === h.text) return;
    editor.chain().focus().insertContentAt({ from: h.from, to: h.to }, next).run();
  };

  async function copyAll() {
    if (!editor) return;
    const html = editor.getHTML();
    const text = editor.getText({ blockSeparator: "\n\n" });
    try {
      if (typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) }),
        ]);
      } else await navigator.clipboard.writeText(text);
      toast({ tone: "success", title: "Copied" });
    } catch {
      toast({ tone: "error", title: "Couldn't copy", description: "Select the text and copy it instead." });
    }
  }

  async function onMenu(action: string) {
    if (!id) return;
    if (action === "copy") return copyAll();
    if (action === "regenerate" || action === "delete") return setConfirm(action);
    if (action === "duplicate") {
      const res = await duplicateCreation({ id }).catch(() => null);
      if (res?.ok && res.newId) router.push(`/spaces/${spaceId}/create/${res.newId}`);
      else toast({ tone: "error", title: "Not duplicated", description: "Check your connection and try again." });
    }
  }

  async function confirmed() {
    const what = confirm;
    setConfirm(null);
    if (!id) return;
    if (what === "regenerate") {
      const q = new URLSearchParams({ type, replace: id });
      if (initial?.instruction) q.set("instruction", initial.instruction);
      q.set("n", Date.now().toString(36));
      router.push(`/spaces/${spaceId}/create/new?${q}`);
      return;
    }
    // Delete: leave at once (optimistic); say so if it didn't work.
    router.push(`/spaces/${spaceId}?tab=create`);
    const res = await deleteCreation({ id }).catch(() => ({ ok: false as const, error: "" }));
    if (res.ok) toast({ tone: "success", title: "Deleted", description: title });
    else toast({ tone: "error", title: "Not deleted", description: "Check your connection and try again." });
  }

  const busy = mode !== "idle";
  const info = TYPE_INFO[type];

  return (
    <div className="mx-auto flex w-full max-w-[52rem] flex-col">
      {banner && (
        <div
          aria-hidden
          className="-mx-4 mb-4 h-28 sm:mx-0 sm:h-40 sm:rounded-card"
          style={{ background: BANNERS[banner] }}
        />
      )}

      {/* Header: icon, add banner, title, type */}
      <div className="flex flex-col items-start gap-1">
        <EmojiButton icon={icon} onPick={(e) => look({ icon: e })} disabled={!id || busy} />
        <BannerButton banner={banner} onPick={(b) => look({ banner: b })} disabled={!id || busy} />
        <InlineTitle value={title} onCommit={rename} disabled={!id || busy} />
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">{info.label}</p>
          <SaveBadge mode={mode} phase={phase} save={save} />
          <div className="ms-auto flex items-center gap-1">
            {busy && (
              <button type="button" onClick={stopAi} className={buttonClasses({ variant: "subtle", size: "md" })}>
                Stop
              </button>
            )}
            <ActionMenu
              label="More actions"
              trigger={<Ellipsis className="size-4" />}
              triggerClassName={buttonClasses({ variant: "subtle", size: "md", className: "w-11 px-0 lg:w-9" })}
              items={[
                { id: "copy", label: "Copy", icon: <Copy className="size-3.5" />, disabled: !id || busy },
                { id: "regenerate", label: "Regenerate", icon: <RotateCw className="size-3.5" />, disabled: !id || busy },
                { id: "duplicate", label: "Duplicate", icon: <Files className="size-3.5" />, disabled: !id || busy },
                { id: "delete", label: "Delete", icon: <Trash2 className="size-3.5" />, disabled: !id || busy },
              ]}
              onSelect={(a) => void onMenu(a)}
            />
          </div>
        </div>
      </div>

      {sources.length > 0 && (
        <details className="mt-3 text-sm text-fg-muted">
          <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1 font-semibold lg:min-h-8">
            Made from {new Set(sources.map((s) => `${s.documentId}:${s.page}`)).size} pages of your files
          </summary>
          <div className="mt-2">
            <SourceCards sources={sources} spaceId={spaceId} />
          </div>
        </details>
      )}

      {unfinished && !busy && !failed && (
        <div role="status" className="mt-4 flex flex-wrap items-center gap-3 rounded-card border border-accent-bottom/40 bg-accent-bottom/10 px-4 py-3 text-sm text-fg-body">
          <VappiPal mood="idle" size={24} label={false} />
          <span className="min-w-0 flex-1">
            Vappi didn&apos;t finish writing this when you left.{canUseAi ? "" : " Upgrade to Pro to let Vappi continue it."}
          </span>
          {canUseAi ? (
            <button type="button" onClick={() => void continueWriting()} className={buttonClasses({ variant: "primary", size: "md" })}>
              Continue writing
            </button>
          ) : (
            <Link href="/billing" className={buttonClasses({ variant: "primary", size: "md" })}>
              Upgrade
            </Link>
          )}
        </div>
      )}

      {failed && (
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-card border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-fg-body">
          <CircleAlert aria-hidden className="size-4 shrink-0 text-danger" />
          <span className="min-w-0 flex-1">{failed}</span>
          {id ? (
            <button type="button" onClick={() => setConfirm("regenerate")} className={buttonClasses({ variant: "secondary", size: "md" })}>
              Try again
            </button>
          ) : (
            <Link href={`/spaces/${spaceId}?tab=create`} className={buttonClasses({ variant: "secondary", size: "md" })}>
              Back
            </Link>
          )}
        </div>
      )}

      {/* Toolbar (sticky under the top bar) */}
      <div className="sticky top-topbar z-20 -mx-4 mt-5 border-y border-border bg-bg px-4 py-1 shadow-[0_8px_16px_-8px_rgb(0_0_0/0.6)] sm:mx-0 sm:rounded-card sm:border sm:px-2">
        {editor && <EditorToolbar editor={editor} locked={busy || !id} />}
      </div>

      {/* Document */}
      <div ref={wrap} className="relative mt-6 min-h-[50vh] pb-40">
        <EditorContent editor={editor} />
        {selBtn && !busy && (
          <button
            type="button"
            // Keep the selection: don't let the click blur the editor first.
            onMouseDown={(e) => e.preventDefault()}
            onClick={openChat}
            className="absolute z-30 inline-flex min-h-11 -translate-x-1/2 items-center gap-1.5 rounded-pill bg-linear-to-b from-accent-top to-accent-bottom px-3.5 text-sm font-semibold text-accent-fg shadow-[inset_0_1px_0_0_rgb(225_205_255/0.5),0_10px_30px_-8px_rgb(120_60_220/0.7)] animate-fade-in lg:min-h-9"
            style={{ left: selBtn.x, top: selBtn.y }}
          >
            <AiIcon />
            Ask Vappi
          </button>
        )}
        <CaretPal target={caret} mood={caretMood} kick={kick} />
        {heading && (
          <input
            autoFocus
            aria-label="Heading"
            defaultValue={heading.text}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => commitHeading(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitHeading(e.currentTarget.value);
              } else if (e.key === "Escape") commitHeading(null);
            }}
            className={cn(
              "absolute z-20 rounded-control bg-surface px-2 font-bold text-fg outline-none ring-1 ring-border-strong",
              heading.level === 1 ? "text-[1.75rem]" : heading.level === 2 ? "text-[1.375rem]" : "text-[1.125rem]",
            )}
            style={{ top: heading.top - 4, left: heading.left - 8, width: Math.max(160, heading.width + 16) }}
          />
        )}
        {busy && (
          <p className="sr-only" aria-live="polite">
            {mode === "writing" ? "Vappi is writing" : "Vappi is editing"}
          </p>
        )}
      </div>

      {/* Keep / Undo after an AI edit */}
      {review && !busy && (
        <div className="sticky bottom-4 z-20 mx-auto flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface px-3 py-2 shadow-[0_16px_40px_rgb(0_0_0/0.55)]">
          <VappiPal mood="happy" size={24} label={false} />
          <span className="text-sm text-fg-body">Vappi edited this.</span>
          <button
            type="button"
            onClick={() => {
              restore(review.before);
              setReview(null);
            }}
            className={buttonClasses({ variant: "subtle", size: "md" })}
          >
            <Undo2 aria-hidden className="size-4" /> Undo
          </button>
          <button type="button" onClick={() => setReview(null)} className={buttonClasses({ variant: "primary", size: "md" })}>
            <Check aria-hidden className="size-4" /> Keep
          </button>
        </div>
      )}

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === "delete" ? "Delete this creation?" : "Regenerate it?"}
        description={
          confirm === "delete"
            ? `“${title}” will be deleted. This can't be undone.`
            : "Vappi will write it again from your files and replace the current content."
        }
        closeLabel="Cancel"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant={confirm === "delete" ? "danger" : "primary"} onClick={() => void confirmed()}>
              {confirm === "delete" ? "Delete" : "Regenerate"}
            </Button>
          </>
        }
      >
        {null}
      </Dialog>
    </div>
  );
}

function SaveBadge({ mode, phase, save }: { mode: Mode; phase: "search" | "write"; save: SaveState }) {
  const text =
    mode === "writing"
      ? phase === "search"
        ? "Vappi is reading your files…"
        : "Vappi is writing…"
      : mode === "editing"
        ? "Vappi is editing…"
        : save === "saving"
          ? "Saving…"
          : save === "retrying"
            ? "Not saved, retrying…"
            : "Saved";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", save === "retrying" && mode === "idle" ? "text-danger" : "text-fg-subtle")}>
      {mode !== "idle" || save === "saving" ? <Loader2 aria-hidden className="size-3 animate-spin" /> : null}
      {text}
    </span>
  );
}
