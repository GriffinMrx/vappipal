import { Icon, type IconName } from "@/components/icons/icon";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/*
 * Small, static product previews for the landing page. All content is sample
 * text written for the page — never anyone's uploaded material.
 */

/* ── How it works ───────────────────────────────────────────────────────── */

function StepFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_top,var(--color-accent-top),transparent_65%)] p-5 sm:p-8">
      {children}
    </div>
  );
}

export function UploadStep() {
  return (
    <StepFrame>
      <div className="w-full max-w-sm rounded-card border border-border bg-bg p-4">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-space-green" />
          <span className="text-sm font-bold text-fg">Biology</span>
          <span className="ms-auto rounded-pill bg-space-orange/15 px-2 py-0.5 text-eyebrow font-semibold text-space-orange">
            Exam · Jun 16
          </span>
        </div>
        <div className="mt-4 flex flex-col items-center gap-2 rounded-control border border-dashed border-border-strong px-4 py-6 text-center">
          <Icon name="rectagular-upload" size={26} className="text-fg-muted" />
          <p className="text-sm font-semibold text-fg-body">Drop your files here</p>
          <p className="text-xs text-fg-subtle">PDF, PowerPoint, Word or a photo</p>
        </div>
      </div>
    </StepFrame>
  );
}

export function ReadStep({ pal }: { pal: ReactNode }) {
  const rows = [
    { name: "Cell biology.pdf", icon: "file-pdf" as const, status: "Ready" },
    { name: "Genetics notes.jpg", icon: "file-image" as const, status: "Ready" },
    { name: "Week 3 lecture.pptx", status: "Processing" },
  ];
  return (
    <StepFrame>
      <div className="flex w-full max-w-sm flex-col gap-3">
        <div className="flex justify-center">{pal}</div>
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.name} className="flex items-center gap-2.5 rounded-control border border-border bg-bg px-3 py-2.5">
              {r.icon ? <Icon name={r.icon} size={18} className="text-fg-muted" /> : <span className="w-4.5" />}
              <span className="min-w-0 flex-1 truncate text-sm text-fg-body">{r.name}</span>
              <span
                className={cn(
                  "shrink-0 rounded-pill px-2 py-0.5 text-eyebrow font-semibold",
                  r.status === "Ready" ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
                )}
              >
                {r.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </StepFrame>
  );
}

export function ModesStep() {
  const modes: { name: string; text: string; icon: IconName }[] = [
    { name: "Learn", text: "Summaries, flashcards and quizzes", icon: "layer" },
    { name: "Ask", text: "Answers that cite their pages", icon: "bubble-chat" },
    { name: "Create", text: "Notes, outlines, emails and more", icon: "note" },
  ];
  return (
    <StepFrame>
      <ul className="flex w-full max-w-sm flex-col gap-2.5">
        {modes.map((m) => (
          <li key={m.name} className="flex items-center gap-3 rounded-card border border-border bg-bg p-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-surface text-fg-body">
              <Icon name={m.icon} size={20} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-fg">{m.name}</span>
              <span className="block text-xs text-fg-muted">{m.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </StepFrame>
  );
}
