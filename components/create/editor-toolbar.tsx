"use client";

import { popoverClasses, usePopover } from "@/components/ui/popover";
import { SelectMenu } from "@/components/ui/select-menu";
import { cn } from "@/lib/cn";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
  Baseline,
  Bold,
  CodeXml,
  Heading1,
  Heading2,
  Highlighter,
  Italic,
  List,
  ListIndentDecrease,
  ListIndentIncrease,
  ListOrdered,
  ListTodo,
  PilcrowLeft,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Subscript,
  Superscript,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignJustify,
  TextAlignStart,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

/** Text colours / highlights from the design palette (null = default). */
const COLORS = ["#f5f5f7", "#a1a1aa", "#a77dff", "#4f8cff", "#2dd4bf", "#22c55e", "#facc15", "#f97316", "#f06363", "#ec4899"];
const HIGHLIGHTS = ["#6b3fd166", "#1f5fa866", "#1d6b5266", "#a1620766", "#9a341266", "#9d174d66", "#52525b88"];

const SIZES = [
  { value: "small", label: "Small", css: "0.875em" },
  { value: "normal", label: "Normal", css: "" },
  { value: "large", label: "Large", css: "1.25em" },
  { value: "huge", label: "Huge", css: "1.75em" },
];
const FONTS = [
  { value: "sans", label: "Sans Serif", css: "" },
  { value: "serif", label: "Serif", css: "Georgia, 'Times New Roman', serif" },
  { value: "mono", label: "Monospace", css: "ui-monospace, SFMono-Regular, Menlo, monospace" },
];
const ALIGNS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "left", label: "Align left", icon: TextAlignStart },
  { value: "center", label: "Align center", icon: TextAlignCenter },
  { value: "right", label: "Align right", icon: TextAlignEnd },
  { value: "justify", label: "Justify", icon: TextAlignJustify },
];

function Btn({
  label,
  icon: IconCmp,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  icon?: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep the editor's selection: don't take focus on mousedown.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-surface hover:text-fg disabled:pointer-events-none disabled:opacity-40 lg:size-8",
        active && "bg-surface-active text-fg",
      )}
    >
      {IconCmp ? <IconCmp aria-hidden className="size-4" strokeWidth={2} /> : children}
    </button>
  );
}

const Sep = () => <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />;

function Swatches({
  label,
  icon,
  colors,
  current,
  onPick,
}: {
  label: string;
  icon: LucideIcon;
  colors: string[];
  current: string | null;
  onPick: (c: string | null) => void;
}) {
  const { popoverRef, triggerProps, hide } = usePopover();
  const IconCmp = icon;
  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        {...triggerProps}
        onMouseDown={(e) => e.preventDefault()}
        className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-control text-fg-muted hover:bg-surface hover:text-fg lg:size-8"
      >
        <IconCmp aria-hidden className="size-4" />
        <span
          aria-hidden
          className="absolute inset-x-2.5 bottom-2 h-0.5 rounded-full lg:inset-x-2 lg:bottom-1"
          style={{ background: current ?? "transparent" }}
        />
      </button>
      <div ref={popoverRef} popover="auto" className={cn(popoverClasses, "w-max p-2")}>
        <div className="grid grid-cols-5 gap-1.5">
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(c);
                hide(false);
              }}
              className={cn(
                "size-9 rounded-control border border-border lg:size-7",
                current === c && "ring-2 ring-fg ring-offset-2 ring-offset-surface",
              )}
              style={{ background: c }}
            />
          ))}
        </div>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onPick(null);
            hide(false);
          }}
          className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-control text-xs font-semibold text-fg-muted hover:bg-surface-active hover:text-fg"
        >
          Default
        </button>
      </div>
    </>
  );
}

/**
 * The Create editor toolbar (controls of the user's reference, in Vappi's
 * style). Scrolls sideways inside itself on small screens.
 */
export function EditorToolbar({ editor, locked }: { editor: Editor; locked: boolean }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      quote: e.isActive("blockquote"),
      code: e.isActive("codeBlock"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      ol: e.isActive("orderedList"),
      ul: e.isActive("bulletList"),
      tasks: e.isActive("taskList"),
      sub: e.isActive("subscript"),
      sup: e.isActive("superscript"),
      rtl: e.getAttributes(e.isActive("heading") ? "heading" : "paragraph").dir === "rtl",
      color: (e.getAttributes("textStyle").color as string | undefined) ?? null,
      bg: (e.getAttributes("textStyle").backgroundColor as string | undefined) ?? null,
      size: (e.getAttributes("textStyle").fontSize as string | undefined) ?? "",
      font: (e.getAttributes("textStyle").fontFamily as string | undefined) ?? "",
      align: ALIGNS.find((a) => e.isActive({ textAlign: a.value }))?.value ?? "left",
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();
  const off = locked;
  const style = s.h1 ? "h1" : s.h2 ? "h2" : s.h3 ? "h3" : "p";
  const selectCls =
    "h-11 rounded-control px-2.5 text-[0.8125rem] font-semibold text-fg-muted hover:bg-surface hover:text-fg lg:h-8";

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className={cn("-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0", off && "pointer-events-none opacity-50")}
    >
      <div className="flex w-max items-center gap-0.5 lg:w-auto lg:flex-wrap">
        <Btn label="Undo" icon={Undo2} disabled={!s.canUndo} onClick={() => c().undo().run()} />
        <Btn label="Redo" icon={Redo2} disabled={!s.canRedo} onClick={() => c().redo().run()} />
        <Sep />
        <Btn label="Bold (Ctrl+B)" icon={Bold} active={s.bold} onClick={() => c().toggleBold().run()} />
        <Btn label="Italic (Ctrl+I)" icon={Italic} active={s.italic} onClick={() => c().toggleItalic().run()} />
        <Btn label="Underline (Ctrl+U)" icon={Underline} active={s.underline} onClick={() => c().toggleUnderline().run()} />
        <Btn label="Strikethrough" icon={Strikethrough} active={s.strike} onClick={() => c().toggleStrike().run()} />
        <Sep />
        <Btn label="Quote" icon={Quote} active={s.quote} onClick={() => c().toggleBlockquote().run()} />
        <Btn label="Code block" icon={CodeXml} active={s.code} onClick={() => c().toggleCodeBlock().run()} />
        <Sep />
        <Btn label="Heading 1" icon={Heading1} active={s.h1} onClick={() => c().toggleHeading({ level: 1 }).run()} />
        <Btn label="Heading 2" icon={Heading2} active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()} />
        <Sep />
        <Btn label="Numbered list" icon={ListOrdered} active={s.ol} onClick={() => c().toggleOrderedList().run()} />
        <Btn label="Bullet list" icon={List} active={s.ul} onClick={() => c().toggleBulletList().run()} />
        <Btn label="Checklist" icon={ListTodo} active={s.tasks} onClick={() => c().toggleTaskList().run()} />
        <Sep />
        <Btn label="Subscript" icon={Subscript} active={s.sub} onClick={() => c().toggleSubscript().run()} />
        <Btn label="Superscript" icon={Superscript} active={s.sup} onClick={() => c().toggleSuperscript().run()} />
        <Sep />
        <Btn label="Outdent (Shift+Tab)" icon={ListIndentDecrease} onClick={() => c().outdent().run()} />
        <Btn label="Indent (Tab)" icon={ListIndentIncrease} onClick={() => c().indent().run()} />
        <Btn label="Right to left" icon={PilcrowLeft} active={s.rtl} onClick={() => c().toggleRtl().run()} />
        <Sep />
        <SelectMenu
          label="Text size"
          value={SIZES.find((x) => x.css === s.size)?.value ?? "normal"}
          placeholder="Normal"
          options={SIZES.map(({ value, label }) => ({ value, label }))}
          onSelect={(v) => {
            const css = SIZES.find((x) => x.value === v)?.css;
            if (css) c().setFontSize(css).run();
            else c().unsetFontSize().run();
          }}
          triggerClassName={cn(selectCls, "w-24")}
        />
        <SelectMenu
          label="Paragraph style"
          value={style}
          placeholder="Normal"
          options={[
            { value: "p", label: "Normal" },
            { value: "h1", label: "Heading 1" },
            { value: "h2", label: "Heading 2" },
            { value: "h3", label: "Heading 3" },
          ]}
          onSelect={(v) =>
            v === "p" ? c().setParagraph().run() : c().setHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run()
          }
          triggerClassName={cn(selectCls, "w-28")}
        />
        <Sep />
        <Swatches
          label="Text colour"
          icon={Baseline}
          colors={COLORS}
          current={s.color}
          onPick={(col) => (col ? c().setColor(col).run() : c().unsetColor().run())}
        />
        <Swatches
          label="Highlight"
          icon={Highlighter}
          colors={HIGHLIGHTS}
          current={s.bg}
          onPick={(col) => (col ? c().setBackgroundColor(col).run() : c().unsetBackgroundColor().run())}
        />
        <SelectMenu
          label="Font"
          value={FONTS.find((f) => f.css === s.font)?.value ?? "sans"}
          placeholder="Sans Serif"
          options={FONTS.map(({ value, label }) => ({ value, label }))}
          onSelect={(v) => {
            const css = FONTS.find((f) => f.value === v)?.css;
            if (css) c().setFontFamily(css).run();
            else c().unsetFontFamily().run();
          }}
          triggerClassName={cn(selectCls, "w-32")}
        />
        <Sep />
        {ALIGNS.map((a) => (
          <Btn key={a.value} label={a.label} icon={a.icon} active={s.align === a.value} onClick={() => c().setTextAlign(a.value).run()} />
        ))}
        <Btn label="Clear formatting" icon={RemoveFormatting} onClick={() => c().unsetAllMarks().clearNodes().run()} />
      </div>
    </div>
  );
}
