"use client";

import { syncTimeZone } from "@/lib/user/actions";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Keeps the stored time zone equal to the browser's, so "today" (greeting,
 * cards due, plan days) is the user's day. Renders nothing.
 */
export function TimeZoneSync({ stored }: { stored: string }) {
  const router = useRouter();
  useEffect(() => {
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browser || browser === stored) return;
    syncTimeZone(browser)
      .then((res) => res.ok && router.refresh())
      .catch(() => {
        /* Non-critical: retried on the next page load. */
      });
  }, [stored, router]);
  return null;
}
