"use server";

import { getCurrentDbUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { validDoc } from "./document";
import { BANNERS, CONTENT_MAX, EMOJIS, TITLE_MAX, type CreationActionResult } from "./types";

const id = z.string().min(1).max(64);

async function owned(userId: string, creationId: string) {
  return db.creation.findFirst({ where: { id: creationId, userId }, select: { id: true, spaceId: true } });
}

/** Rename (optimistic in the UI). */
export async function renameCreation(input: { id: string; title: string }): Promise<CreationActionResult> {
  const user = await getCurrentDbUser();
  const parsed = z.object({ id, title: z.string().trim().min(1, "Give it a title.").max(TITLE_MAX) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid title." };
  const c = await owned(user.id, parsed.data.id);
  if (!c) return { ok: false, error: "Not found." };
  await db.creation.update({ where: { id: c.id }, data: { title: parsed.data.title } });
  revalidatePath(`/spaces/${c.spaceId}`);
  return { ok: true };
}

/** Emoji icon and banner (null removes). */
export async function setCreationLook(input: { id: string; icon?: string | null; banner?: string | null }): Promise<CreationActionResult> {
  const user = await getCurrentDbUser();
  const parsed = z
    .object({
      id,
      icon: z.enum(EMOJIS as [string, ...string[]]).nullable().optional(),
      banner: z.enum(Object.keys(BANNERS) as [string, ...string[]]).nullable().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Not saved." };
  const c = await owned(user.id, parsed.data.id);
  if (!c) return { ok: false, error: "Not found." };
  const { icon, banner } = parsed.data;
  await db.creation.update({
    where: { id: c.id },
    data: { ...(icon !== undefined ? { icon } : {}), ...(banner !== undefined ? { banner } : {}) },
  });
  revalidatePath(`/spaces/${c.spaceId}`);
  return { ok: true };
}

/**
 * Autosave: the editor document as a JSON string (ProseMirror attrs are
 * null-prototype objects, which server actions can't receive as objects),
 * validated against the editor schema and size-capped.
 */
export async function saveCreationContent(input: { id: string; content: string }): Promise<CreationActionResult> {
  const user = await getCurrentDbUser();
  const parsed = z.object({ id, content: z.string().max(CONTENT_MAX) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "This document is too large to save." };
  let json: unknown;
  try {
    json = JSON.parse(parsed.data.content);
  } catch {
    return { ok: false, error: "Not saved." };
  }
  const doc = validDoc(json);
  if (!doc) return { ok: false, error: "This document can't be saved (too large or invalid)." };
  const c = await owned(user.id, parsed.data.id);
  if (!c) return { ok: false, error: "Not found." };
  await db.creation.update({
    where: { id: c.id },
    data: { content: doc as Prisma.InputJsonValue, markdown: null, status: "READY" },
  });
  return { ok: true };
}

export async function deleteCreation(input: { id: string }): Promise<CreationActionResult> {
  const user = await getCurrentDbUser();
  const parsed = z.object({ id }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Not found." };
  const c = await owned(user.id, parsed.data.id);
  if (!c) return { ok: false, error: "Not found." };
  await db.creation.delete({ where: { id: c.id } });
  revalidatePath(`/spaces/${c.spaceId}`);
  return { ok: true };
}

/** A copy of an existing creation (not a new AI creation: no usage counted). */
export async function duplicateCreation(input: { id: string }): Promise<CreationActionResult & { newId?: string }> {
  const user = await getCurrentDbUser();
  const parsed = z.object({ id }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Not found." };
  const c = await db.creation.findFirst({ where: { id: parsed.data.id, userId: user.id } });
  if (!c) return { ok: false, error: "Not found." };
  const copy = await db.creation.create({
    data: {
      userId: user.id,
      spaceId: c.spaceId,
      type: c.type,
      title: `${c.title} (copy)`.slice(0, TITLE_MAX),
      icon: c.icon,
      banner: c.banner,
      instruction: c.instruction,
      content: (c.content ?? undefined) as Prisma.InputJsonValue | undefined,
      markdown: c.markdown,
      sources: c.sources as Prisma.InputJsonValue,
      status: c.status === "WRITING" ? "READY" : c.status,
    },
    select: { id: true },
  });
  revalidatePath(`/spaces/${c.spaceId}`);
  return { ok: true, newId: copy.id };
}
