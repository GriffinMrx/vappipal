"use client";

import { ProFeatureCard } from "@/components/layout/pro-feature-card";
import { X } from "lucide-react";
import { useChatPanel } from "./chat-panel";

/** Free plan: the chat (asking and AI editing) is Pro (AGENTS.md §1, §11: show the limit and the upgrade, not a failed action). */
export function ChatUpgradePanel() {
  const { setOpen } = useChatPanel();
  return (
    <div className="flex h-full flex-col gap-3 rounded-card border border-border bg-surface/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-fg-body">Chat</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close chat"
          className="inline-flex size-11 items-center justify-center rounded-control text-fg-muted hover:bg-surface hover:text-fg lg:size-9"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <ProFeatureCard
        title="Vappi's AI chat is a Pro feature"
        description="Ask about your files with links to the pages, and let Vappi edit your documents live while you watch."
      />
    </div>
  );
}
