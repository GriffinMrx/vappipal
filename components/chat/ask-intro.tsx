"use client";

import { AiIcon } from "@/components/ui/ai-icon";
import { VappiPal } from "@/components/pal/vappi-pal";
import { buttonClasses } from "@/components/ui/button";
import { useChatPanel } from "./chat-panel";

/** Ask mode: the chat lives in the side panel; this opens (or re-opens) it. */
export function AskIntro({ spaceName }: { spaceName: string }) {
  const { open, setOpen } = useChatPanel();
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-card border border-dashed border-border px-6 py-12 text-center">
      <VappiPal mood="idle" size={64} followPointer label="Vappi" />
      <div className="flex max-w-sm flex-col gap-1">
        <h2 className="text-base font-bold text-fg">Ask anything about {spaceName}</h2>
        <p className="text-sm text-fg-muted">
          Vappi answers only from your files in this Space, with links to the pages it used.
        </p>
      </div>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} className={buttonClasses({ variant: "accent", size: "md" })}>
          <AiIcon />
          Open the chat
        </button>
      )}
    </div>
  );
}
