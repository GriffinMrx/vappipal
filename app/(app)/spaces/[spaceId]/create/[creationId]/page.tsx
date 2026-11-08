import { ChatPanelLayout, ChatToggleButton } from "@/components/chat/chat-panel";
import { SpaceChatSlot } from "@/components/chat/space-chat-slot";
import { CreationEditor } from "@/components/create/creation-editor";
import { getCurrentDbUser } from "@/lib/auth/current-user";
import { hasProAccess } from "@/lib/billing/access";
import { db } from "@/lib/db";
import { getCreation } from "@/lib/creations/queries";
import { CREATION_TYPES, INSTRUCTION_MAX, type CreationType } from "@/lib/creations/types";
import { getSpace } from "@/lib/spaces/queries";
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Create · Vappi" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * A creation in the editor. `/create/new?type=…&instruction=…` starts a new
 * one (Vappi writes it live; `replace=<id>` regenerates an existing one).
 */
export default async function CreationPage({
  params,
  searchParams,
}: {
  params: Promise<{ spaceId: string; creationId: string }>;
  searchParams: SearchParams;
}) {
  const [{ spaceId, creationId }, sp] = await Promise.all([params, searchParams]);
  const user = await getCurrentDbUser();
  const space = await getSpace(user.id, spaceId);
  if (!space) notFound();

  let start: { type: CreationType; instruction: string | null; replaceId?: string } | null = null;
  let initial = null;
  if (creationId === "new") {
    const type = one(sp.type)?.toUpperCase();
    if (!type || !(CREATION_TYPES as readonly string[]).includes(type)) notFound();
    const replaceId = one(sp.replace);
    if (replaceId) {
      initial = await getCreation(user.id, space.id, replaceId);
      if (!initial) notFound();
    }
    start = {
      type: type as CreationType,
      instruction: one(sp.instruction)?.trim().slice(0, INSTRUCTION_MAX) || null,
      replaceId: replaceId ?? undefined,
    };
  } else {
    initial = await getCreation(user.id, space.id, creationId);
    if (!initial) notFound();
  }

  // Vappi's AI editing is Pro (the edit route checks it too); the pace comes from Settings.
  const [pro, prefs] = await Promise.all([
    hasProAccess(user.id),
    db.user.findUnique({ where: { id: user.id }, select: { writingSpeed: true, updatedAt: true } }),
  ]);

  return (
    <ChatPanelLayout chat={<SpaceChatSlot userId={user.id} spaceId={space.id} spaceName={space.name} />}>
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/spaces/${space.id}?tab=create`}
          className="inline-flex min-h-11 items-center gap-1 rounded-control text-sm font-semibold text-fg-muted hover:text-fg lg:min-h-9"
        >
          <ChevronLeft aria-hidden className="size-4" />
          <span className="wrap-anywhere">{space.name} · Create</span>
        </Link>
        <ChatToggleButton />
      </div>
      <div className="mt-4">
        <CreationEditor key={`${creationId}:${one(sp.replace) ?? ""}`} spaceId={space.id} initial={initial} start={start} canUseAi={pro} speed={pro ? (prefs?.writingSpeed ?? "NORMAL") : "NORMAL"}
          speedAt={prefs?.updatedAt.getTime() ?? 0} />
      </div>
    </ChatPanelLayout>
  );
}
