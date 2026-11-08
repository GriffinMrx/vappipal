"use client";

import { useEffect, useState } from "react";
import { usePalMood, usePalVersion } from "./pal-store";
import { VappiPal } from "./vappi-pal";

const SLEEP_AFTER_MS = 60_000;

/**
 * The pal next to the logo: mirrors what the AI is doing anywhere in the app
 * (thinking, searching, writing, happy…). Idle for a minute → falls asleep;
 * hovering or any AI activity wakes it up. Decorative (the logo link has the name).
 */
export function LogoPal({ size = 26 }: { size?: number }) {
  const mood = usePalMood();
  const version = usePalVersion();
  const [poke, setPoke] = useState(0);
  // Asleep only for the activity "moment" it fell asleep in.
  const [sleptAt, setSleptAt] = useState<string | null>(null);
  const moment = `${version}:${poke}`;

  useEffect(() => {
    if (mood !== "idle") return;
    const t = setTimeout(() => setSleptAt(moment), SLEEP_AFTER_MS);
    return () => clearTimeout(t);
  }, [mood, moment]);

  const shown = mood !== "idle" ? mood : sleptAt === moment ? "sleeping" : "idle";

  return (
    <span onPointerEnter={() => setPoke((p) => p + 1)} className="inline-flex">
      <VappiPal mood={shown} size={size} followPointer={shown === "idle"} label={false} />
    </span>
  );
}
