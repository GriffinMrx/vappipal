import { hasProAccess } from "@/lib/billing/access";
import { listChatMessages } from "@/lib/chat/queries";
import { ChatUpgradePanel } from "./chat-upgrade";
import { SpaceChat } from "./space-chat";

/**
 * Server slot for the Space's side chat, used by the Space and Create pages.
 * The chat (asking and AI editing) is Pro only.
 */
export async function SpaceChatSlot({ userId, spaceId, spaceName }: { userId: string; spaceId: string; spaceName: string }) {
  if (!(await hasProAccess(userId))) return <ChatUpgradePanel />;
  const messages = await listChatMessages(userId, spaceId);
  return <SpaceChat spaceId={spaceId} spaceName={spaceName} initialMessages={messages} />;
}
