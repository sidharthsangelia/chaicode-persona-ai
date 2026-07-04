"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { UIMessage } from "ai";
import { ensureChat, ensureUser, saveTurn } from "@/lib/chat/store";

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

  const { count } = await prisma.chat.deleteMany({ where: { id: chatId, userId } });
  if (count === 0) return { error: "Chat not found" };

  revalidatePath("/", "layout");
  return { success: true as const };
}


export async function pruneMessagesFromAction(chatId: string, fromMessageId: string) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized" };

  const chat = await prisma.chat.findFirst({ where: { id: chatId, userId } });
  if (!chat) return { error: "Chat not found" };

  const target = await prisma.message.findUnique({ where: { id: fromMessageId } });
  if (!target || target.chatId !== chatId) return { error: "Message not found" };

  await prisma.message.deleteMany({ where: { chatId, createdAt: { gte: target.createdAt } } });
  return { success: true as const };
}


export async function importGuestChatAction({
  chatId,
  personaId,
  messages,
}: {
  chatId: string;
  personaId: string;
  messages: UIMessage[];
}) {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized" };

  const firstUserText =
    messages.find((m) => m.role === "user")?.parts.find((p) => p.type === "text")?.text ?? "New chat";

  await ensureUser(userId);
  await ensureChat({ chatId, userId, personaId, firstUserText });
  await saveTurn({ chatId, messages });

  revalidatePath("/", "layout");
  return { chatId };
}