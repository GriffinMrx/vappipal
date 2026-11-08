import "server-only";

import { cache } from "react";
import { dateColumnToDay, endOfTodayInZone } from "@/lib/dates";
import { db } from "@/lib/db";
import type { SpaceView } from "./types";

/** All of a user's spaces, newest first. Always scoped by userId. Cached per request. */
export const listSpaces = cache(async (userId: string): Promise<SpaceView[]> => {
  const rows = await db.space.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      color: true,
      goalDate: true,
      goalLabel: true,
      _count: { select: { documents: true } },
    },
  });
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    goalDate: s.goalDate ? dateColumnToDay(s.goalDate) : null,
    goalLabel: s.goalLabel,
    documentCount: s._count.documents,
  }));
});

/** A single space owned by the user, or null. */
export async function getSpace(userId: string, spaceId: string) {
  return db.space.findFirst({
    where: { id: spaceId, userId },
    select: { id: true, name: true, color: true, goalDate: true, goalLabel: true },
  });
}

/** Counts and recent documents for the Home dashboard. */
export async function getHomeData(userId: string, timeZone: string) {
  const endOfToday = endOfTodayInZone(timeZone);
  const [cardsDue, documentCount, recentDocuments] = await Promise.all([
    db.flashcard.count({ where: { userId, nextReviewAt: { lt: endOfToday } } }),
    db.document.count({ where: { userId } }),
    db.document.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        fileType: true,
        status: true,
        pageCount: true,
        createdAt: true,
        space: { select: { id: true, name: true, color: true } },
      },
    }),
  ]);
  const now = Date.now();
  return {
    cardsDue,
    documentCount,
    recentDocuments: recentDocuments.map((d) => ({
      ...d,
      // Negative = days ago (for Intl.RelativeTimeFormat).
      daysAgo: Math.round((d.createdAt.getTime() - now) / 86_400_000),
    })),
  };
}
