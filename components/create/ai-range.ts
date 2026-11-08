import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// Plain module (no "use client" needed): the editor extension that tints the
// range Vappi is rewriting, so the user sees exactly what it's touching.

export const aiRangeKey = new PluginKey<DecorationSet>("aiRange");

/** `inline`: tint exactly from..to (words); otherwise the whole blocks it touches. */
export type AiRange = { from: number; to: number; className: string; inline?: boolean } | null;

/** Set with: editor.view.dispatch(editor.state.tr.setMeta(aiRangeKey, range)). */
export const AiRangeHighlight = Extension.create({
  name: "aiRange",
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: aiRangeKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const meta = tr.getMeta(aiRangeKey) as AiRange | undefined;
            if (meta === null) return DecorationSet.empty;
            if (meta) {
              const to = Math.min(meta.to, tr.doc.content.size);
              if (to <= meta.from) return DecorationSet.empty;
              if (meta.inline) return DecorationSet.create(tr.doc, [Decoration.inline(meta.from, to, { class: meta.className })]);
              const decos: Decoration[] = [];
              // Tint whole blocks (the edit replaces whole blocks).
              tr.doc.nodesBetween(meta.from, to, (node, pos) => {
                if (node.isBlock && node.isTextblock) {
                  decos.push(Decoration.node(pos, pos + node.nodeSize, { class: meta.className }));
                  return false;
                }
                return true;
              });
              return DecorationSet.create(tr.doc, decos);
            }
            return set.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return aiRangeKey.getState(state);
          },
        },
      }),
    ];
  },
});
