"use client";

import { cn } from "@/lib/cn";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Flip Words, adapted from Aceternity UI (ui.aceternity.com/components/flip-words).
 * Cycles through `words`, letters blurring in one by one. Screen readers get
 * every word once, as plain text. Reduced motion: the first word, still.
 */
export function FlipWords({ words, duration = 2800, className }: { words: string[]; duration?: number; className?: string }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (reduce || animating) return;
    const t = setTimeout(() => {
      setIndex((i) => (i + 1) % words.length);
      setAnimating(true);
    }, duration);
    return () => clearTimeout(t);
  }, [reduce, animating, duration, words.length]);

  const word = reduce ? words[0] : words[index];

  return (
    <span className="relative inline-block">
      <span className="sr-only">{words.join(" ")}</span>
      <AnimatePresence onExitComplete={() => setAnimating(false)}>
        <motion.span
          key={word}
          aria-hidden
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 10 }}
          exit={{ opacity: 0, y: -32, x: 32, filter: "blur(8px)", scale: 1.6, position: "absolute" }}
          className={cn("relative z-10 inline-block text-start", className)}
        >
          {word.split(" ").map((part, wi) => (
            <motion.span
              key={`${part}-${wi}`}
              initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: wi * 0.25, duration: 0.3 }}
              className="inline-block whitespace-nowrap"
            >
              {part.split("").map((letter, li) => (
                <motion.span
                  key={`${part}-${li}`}
                  initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ delay: wi * 0.25 + li * 0.04, duration: 0.2 }}
                  className="inline-block"
                >
                  {letter}
                </motion.span>
              ))}
              {wi < word.split(" ").length - 1 && <span className="inline-block">&nbsp;</span>}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
