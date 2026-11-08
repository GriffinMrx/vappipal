import { Extension, getSchema, type AnyExtension } from "@tiptap/core";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { TextAlign } from "@tiptap/extension-text-align";
import { BackgroundColor, Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { StarterKit } from "@tiptap/starter-kit";

// Plain module (no "use client"): the editor (browser) and the server
// (validating saves, turning the AI's Markdown into a document) share the
// exact same schema.

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      /** Indent the block (or nest the list item). */
      indent: () => ReturnType;
      /** Outdent the block (or lift the list item). */
      outdent: () => ReturnType;
      /** Right-to-left on/off for the current block. */
      toggleRtl: () => ReturnType;
    };
  }
}

const MAX_INDENT = 6;
const INDENTED = ["paragraph", "heading"];

/** Block indent and right-to-left (paragraphs and headings); lists nest instead. */
export const Indent = Extension.create({
  name: "indent",
  addGlobalAttributes() {
    return [
      {
        types: INDENTED,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => Math.min(MAX_INDENT, Number(el.getAttribute("data-indent")) || 0),
            renderHTML: (attrs) =>
              attrs.indent
                ? { "data-indent": attrs.indent, style: `margin-inline-start: ${attrs.indent * 1.5}rem` }
                : {},
          },
          dir: {
            default: null,
            parseHTML: (el) => (el.getAttribute("dir") === "rtl" ? "rtl" : null),
            renderHTML: (attrs) => (attrs.dir === "rtl" ? { dir: "rtl" } : {}),
          },
        },
      },
    ];
  },
  addCommands() {
    const shift =
      (delta: number) =>
      () =>
      ({ editor, chain }: { editor: import("@tiptap/core").Editor; chain: () => import("@tiptap/core").ChainedCommands }) => {
        for (const list of ["taskItem", "listItem"]) {
          if (editor.isActive(list)) {
            return delta > 0 ? chain().sinkListItem(list).run() : chain().liftListItem(list).run();
          }
        }
        const type = editor.isActive("heading") ? "heading" : "paragraph";
        const current = (editor.getAttributes(type).indent as number) || 0;
        const next = Math.max(0, Math.min(MAX_INDENT, current + delta));
        return chain().updateAttributes(type, { indent: next }).run();
      };
    return {
      indent: shift(1),
      outdent: shift(-1),
      toggleRtl:
        () =>
        ({ editor, chain }) => {
          const type = editor.isActive("heading") ? "heading" : "paragraph";
          const rtl = editor.getAttributes(type).dir === "rtl";
          return chain().updateAttributes(type, { dir: rtl ? null : "rtl" }).run();
        },
    };
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => (this.editor.isActive("codeBlock") ? false : this.editor.commands.indent()),
      "Shift-Tab": () => this.editor.commands.outdent(),
    };
  },
});

export const SAFE_LINK = /^(https?:|mailto:)/i;

/** Every content extension of the Create editor (no UI-only ones like Placeholder). */
export const contentExtensions: AnyExtension[] = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
      isAllowedUri: (url) => SAFE_LINK.test(url),
      HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
    },
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  TextStyle,
  Color,
  BackgroundColor,
  FontFamily,
  FontSize,
  Subscript,
  Superscript,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Indent,
];

let schema: ReturnType<typeof getSchema> | null = null;
/** The ProseMirror schema of the Create editor (built once). */
export function creationSchema() {
  schema ??= getSchema(contentExtensions);
  return schema;
}
