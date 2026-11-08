import { daysBetween, nextDay } from "@/lib/dates";
import type { PlanDay, PlanTask } from "./types";

/**
 * The goal plan, in plain code (AGENTS.md §10: never AI). Pure and
 * deterministic, so it's unit-tested and rebuilt freely.
 *
 * - Days run from `today` to the day before the goal date.
 * - The last R days are review days; the S days before them are study days.
 * - Documents are spread over the study days in upload order.
 * - Reviewed flashcards go on their due day; new cards go on the day their
 *   document is read (so day 1 isn't every card at once).
 * - A quiz every 3rd study day and on every review day.
 * - Task ids are deterministic, and ids in `doneIds` come back ticked.
 */

export type PlanInput = {
  today: string;
  goalDay: string;
  documents: { id: string; title: string }[];
  /** `dueDay` already in the user's zone. */
  cards: { documentId: string | null; dueDay: string; isNew: boolean }[];
  hasQuestions: boolean;
  doneIds: Set<string>;
};

export function reviewDayCount(n: number) {
  return n >= 7 ? 3 : n >= 4 ? 2 : n >= 2 ? 1 : 0;
}

export function buildPlan(input: PlanInput): PlanDay[] {
  const { today, goalDay, documents, cards, hasQuestions, doneIds } = input;
  const total = daysBetween(today, goalDay); // days before the goal date
  if (total < 0) return [];

  // Goal date today or tomorrow: one day of review.
  const n = Math.max(total, 1);
  const days: string[] = [];
  for (let d = today, i = 0; i < n; i++, d = nextDay(d)) days.push(d);
  const reviewCount = total <= 1 ? 1 : reviewDayCount(n);
  const studyCount = n - reviewCount;

  // Reading: skip documents already read; spread the rest over the study days.
  const toRead = documents.filter((d) => !doneIds.has(`read:${d.id}`));
  const readDay = new Map<string, number>();
  const readsByDay: { id: string; title: string }[][] = days.map(() => []);
  toRead.forEach((doc, i) => {
    // No study days (goal date is near): read everything today.
    const idx = studyCount > 0 ? Math.floor((i * studyCount) / toRead.length) : 0;
    readDay.set(doc.id, idx);
    readsByDay[idx].push(doc);
  });

  // Flashcards per day.
  const cardsByDay = days.map(() => 0);
  const lastIdx = n - 1;
  let leftover = 0;
  for (const card of cards) {
    let idx: number;
    if (card.isNew && card.documentId && readDay.has(card.documentId)) {
      idx = readDay.get(card.documentId)!;
    } else {
      idx = Math.max(0, daysBetween(today, card.dueDay)); // overdue → today
    }
    if (idx > lastIdx) {
      leftover++; // due after the goal date
      continue;
    }
    cardsByDay[idx]++;
  }
  // Review days pull in cards that would otherwise only come after the goal date.
  if (reviewCount > 0 && leftover > 0) cardsByDay[studyCount] += leftover;

  return days.map((day, i) => {
    const review = i >= studyCount;
    const tasks: PlanTask[] = [];
    for (const doc of readsByDay[i]) {
      tasks.push({ id: `read:${doc.id}`, kind: "read", documentId: doc.id, title: doc.title, done: false });
    }
    if (cardsByDay[i] > 0) tasks.push({ id: `cards:${day}`, kind: "cards", count: cardsByDay[i], done: false });
    if (hasQuestions && (review || (i + 1) % 3 === 0)) tasks.push({ id: `quiz:${day}`, kind: "quiz", done: false });
    return { day, review, tasks: tasks.map((t) => ({ ...t, done: doneIds.has(t.id) })) };
  });
}
