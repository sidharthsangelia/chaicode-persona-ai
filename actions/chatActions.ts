"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import type { ChatMessage } from "@/lib/chat/messages";
import { ensureChat, saveTurn } from "@/lib/chat/store";
import { prisma } from "@/lib/prisma";

export async function renameChatAction(chatId: string, title: string) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized" };

  const trimmed = title.trim().slice(0, 60);
  if (!trimmed) return { error: "Title can't be empty" };

  const { count } = await prisma.chat.updateMany({
    where: { id: chatId, userId },
    data: { title: trimmed },
  });
  if (count === 0) return { error: "Chat not found" };

  revalidatePath("/", "layout");
  return { title: trimmed };
}

export async function deleteChatAction(chatId: string) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized" };

  const { count } = await prisma.chat.deleteMany({
    where: { id: chatId, userId },
  });
  if (count === 0) return { error: "Chat not found" };

  revalidatePath("/", "layout");
  return { success: true as const };
}

export async function pruneMessagesFromAction(
  chatId: string,
  fromMessageId: string,
) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized" };

  // One lookup rather than three: matching on the chat's owner proves the
  // message is in this user's chat and hands back the cutoff at the same time.
  const target = await prisma.message.findFirst({
    where: { id: fromMessageId, chatId, chat: { userId } },
    select: { createdAt: true },
  });
  if (!target) return { error: "Message not found" };

  await prisma.message.deleteMany({
    where: { chatId, createdAt: { gte: target.createdAt } },
  });
  return { success: true as const };
}

export async function importGuestChatAction({
  chatId,
  personaId,
  messages,
}: {
  chatId: string;
  personaId: string;
  messages: ChatMessage[];
}) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized" };

  const firstUserText =
    messages
      .find((m) => m.role === "user")
      ?.parts.find((p) => p.type === "text")?.text ?? "New chat";

  const owned = await ensureChat({ chatId, userId, personaId, firstUserText });
  if (!owned) return { error: "Chat not found" };
  await saveTurn({ chatId, messages });

  revalidatePath("/", "layout");
  return { chatId };
}
