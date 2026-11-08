// Plain module (no "use client" needed): turns Vappi's edit plan into exact
// document ranges, so each change touches only what the user asked for.

import type { EditOp } from "@/lib/creations/edit-plan";
import type { Node as PMNode } from "@tiptap/pm/model";

/** One change to play, in original-document positions. */
export type PlanStep =
  /** Replace words inside one textblock with inline text ("" deletes). */
  | { kind: "inline"; from: number; to: number; text: string }
  /** Replace whole blocks (or insert when from === to) with Markdown blocks. */
  | { kind: "blocks"; from: number; to: number; text: string }
  /** Insert list items inside a list, at `from`. */
  | { kind: "items"; from: number; to: number; text: string };

export type MetaStep = { kind: "title"; title: string } | { kind: "icon"; emoji: string } | { kind: "banner"; banner: string | null };

export type Selection = { from: number; to: number; inline: boolean } | null;

const LEAF = "￼";
const stripMd = (s: string) => s.replace(/[*_`~]/g, "").replace(/\s+/g, " ").trim();

/** Every textblock with its plain text; text offset i ↔ position pos + 1 + i. */
function textblocks(doc: PMNode) {
  const out: { pos: number; node: PMNode; text: string }[] = [];
  doc.descendants((node, pos) => {
    if (node.isTextblock) {
      out.push({ pos, node, text: node.textBetween(0, node.content.size, undefined, LEAF) });
      return false;
    }
    return true;
  });
  return out;
}

/** Ranges where `find` appears inside one textblock (exact → case-insensitive → without Markdown / extra spaces). */
export function findText(doc: PMNode, find: string, all = false): { from: number; to: number }[] {
  const blocks = textblocks(doc);
  const tries: ((s: string) => string)[] = [(s) => s, (s) => s.toLowerCase()];
  const needles = [find, find.toLowerCase(), stripMd(find), stripMd(find).toLowerCase()];
  for (let t = 0; t < needles.length; t++) {
    const needle = needles[t];
    if (!needle) continue;
    const norm = tries[t % 2];
    const hits: { from: number; to: number }[] = [];
    for (const b of blocks) {
      const hay = norm(b.text);
      let i = hay.indexOf(needle);
      while (i >= 0) {
        hits.push({ from: b.pos + 1 + i, to: b.pos + 1 + i + needle.length });
        if (!all) return hits;
        i = hay.indexOf(needle, i + needle.length);
      }
    }
    if (hits.length) return hits;
  }
  return [];
}

/** Top-level blocks as ranges (block n = index n - 1). */
export function topBlocks(doc: PMNode) {
  const out: { from: number; to: number }[] = [];
  doc.forEach((node, offset) => out.push({ from: offset, to: offset + node.nodeSize }));
  return out;
}

/** The top-level block range around a selection. */
function aroundTop(doc: PMNode, from: number, to: number) {
  const $from = doc.resolve(from);
  const $to = doc.resolve(to);
  return { from: $from.depth > 0 ? $from.before(1) : 0, to: $to.depth > 0 ? $to.after(1) : doc.content.size };
}

/**
 * Plan → steps in document order, non-overlapping (later overlapping ones are
 * dropped), plus the page changes. `skipped` counts what couldn't be placed.
 */
export function resolvePlan(doc: PMNode, ops: EditOp[], selection: Selection) {
  const steps: PlanStep[] = [];
  const meta: MetaStep[] = [];
  let skipped = 0;
  const top = topBlocks(doc);

  for (const op of ops) {
    switch (op.op) {
      case "set_title":
        meta.push({ kind: "title", title: op.title });
        break;
      case "set_icon":
        meta.push({ kind: "icon", emoji: op.emoji });
        break;
      case "set_banner":
        meta.push({ kind: "banner", banner: op.banner });
        break;
      case "replace_text": {
        const hits = findText(doc, op.find, op.all);
        if (!hits.length) skipped++;
        for (const h of hits) steps.push({ kind: "inline", ...h, text: op.replace });
        break;
      }
      case "replace_selection": {
        if (!selection) {
          skipped++;
          break;
        }
        if (selection.inline) steps.push({ kind: "inline", from: selection.from, to: selection.to, text: op.markdown.trim() });
        else steps.push({ kind: "blocks", ...aroundTop(doc, selection.from, selection.to), text: op.markdown });
        break;
      }
      case "replace_blocks": {
        const a = top[op.from - 1];
        const b = top[Math.min(op.to, top.length) - 1];
        if (!a || !b || op.to < op.from) skipped++;
        else steps.push({ kind: "blocks", from: a.from, to: b.to, text: op.markdown });
        break;
      }
      case "insert": {
        const at = op.after <= 0 ? 0 : (top[Math.min(op.after, top.length) - 1]?.to ?? doc.content.size);
        steps.push({ kind: "blocks", from: at, to: at, text: op.markdown });
        break;
      }
      case "insert_after_text": {
        const hit = findText(doc, op.anchor)[0];
        if (!hit) {
          skipped++;
          break;
        }
        const $p = doc.resolve(hit.from);
        let item = -1;
        for (let d = $p.depth; d > 0; d--) if (/item/i.test($p.node(d).type.name)) item = d;
        const isItem = item > 0 && /^\s*([-*+]|\d+\.)\s/.test(op.markdown);
        if (isItem) {
          // Deepest list item containing the anchor.
          let d = $p.depth;
          while (d > 0 && !/item/i.test($p.node(d).type.name)) d--;
          const at = $p.after(d);
          steps.push({ kind: "items", from: at, to: at, text: op.markdown });
        } else {
          const at = $p.after(1);
          steps.push({ kind: "blocks", from: at, to: at, text: op.markdown });
        }
        break;
      }
    }
  }

  steps.sort((x, y) => x.from - y.from || x.to - y.to);
  const kept: PlanStep[] = [];
  let end = -1;
  for (const s of steps) {
    if (s.from < end) {
      skipped++;
      continue;
    }
    kept.push(s);
    end = Math.max(end, s.to);
  }
  return { steps: kept, meta, skipped };
}

/** Is this inline replacement plain text (keeps the existing formatting)? */
export const isPlain = (text: string) => !/[*_`~[\]<>]/.test(text);
