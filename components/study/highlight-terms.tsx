import { highlightParts } from "@/lib/study/highlight";

/** Text with key terms marked. Plain-text splitting only (no HTML injection). */
export function HighlightTerms({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlightParts(text, terms).map((p, i) =>
        p.mark ? (
          <mark key={i} className="rounded bg-accent-bottom/30 px-0.5 font-semibold text-fg">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}
