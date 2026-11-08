"use client";

import { useEffect, useRef } from "react";
import type { ViewProps } from "./types";

/** A photo of notes: fitted to the width; the toolbar's zoom makes it bigger (it pans in the box). */
export function ImageView({ url, onTotal, onReady, onError, alt }: ViewProps & { alt: string }) {
  const cb = useRef({ onTotal, onReady });
  useEffect(() => {
    cb.current = { onTotal, onReady };
  });
  return (
    <div data-vpage={1} className="w-full overflow-hidden rounded-md bg-surface">
      {/* eslint-disable-next-line @next/next/no-img-element -- a private signed URL, not an optimisable static image */}
      <img
        src={url}
        alt={alt}
        className="block h-auto w-full"
        onLoad={() => {
          cb.current.onTotal(1);
          cb.current.onReady();
        }}
        onError={onError}
      />
    </div>
  );
}
