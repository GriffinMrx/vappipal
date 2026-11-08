"use client";

import { cn } from "@/lib/cn";
import { Check, Copy, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";

/** Copy that also works on plain-http LAN addresses (no Clipboard API there). */
async function copyText(text: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

const btn =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-control px-2 text-xs font-semibold text-fg-subtle transition-colors hover:bg-surface hover:text-fg-body disabled:pointer-events-none disabled:opacity-40 lg:min-h-8 lg:min-w-8";

/** Copy (+ Regenerate on the latest answer) under a message. */
export function MessageActions({
  getText,
  onRegenerate,
  regenerateDisabled,
  align = "start",
}: {
  getText: () => string;
  onRegenerate?: () => void;
  regenerateDisabled?: boolean;
  align?: "start" | "end";
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <div className={cn("-mx-2 flex items-center gap-0.5", align === "end" && "justify-end")}>
      <button
        type="button"
        className={btn}
        aria-label={copied ? "Copied" : "Copy message"}
        onClick={async () => setCopied(await copyText(getText()))}
      >
        {copied ? <Check aria-hidden className="size-3.5 text-success" /> : <Copy aria-hidden className="size-3.5" />}
        <span className={cn(!copied && "sr-only")} role="status">
          {copied ? "Copied" : ""}
        </span>
      </button>
      {onRegenerate && (
        <button type="button" className={btn} onClick={onRegenerate} disabled={regenerateDisabled} aria-label="Regenerate answer">
          <RotateCw aria-hidden className="size-3.5" />
          <span className="hidden sm:inline">Regenerate</span>
        </button>
      )}
    </div>
  );
}
