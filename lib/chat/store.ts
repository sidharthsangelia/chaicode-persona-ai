import "server-only";
import { prisma } from "@/lib/prisma";
import type { UIMessage } from "ai";

export async function ensureUser(userId: string) {
  await prisma.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
}

export async function ensureChat({
  chatId, userId, personaId, firstUserText,
}: { chatId: string; userId: string; personaId: string; firstUserText: string }) {
  const existing = await prisma.chat.findUnique({ where: { id: chatId } });
  if (existing) return existing;
  return prisma.chat.create({ data: { id: chatId, userId, personaId, title: firstUserText.slice(0, 60) } });
}

export async function saveTurn({ chatId, messages }: { chatId: string; messages: UIMessage[] }) {
  await prisma.message.createMany({
    data: messages.map((m) => ({ id: m.id, chatId, role: m.role, parts: m.parts as object })),
    skipDuplicates: true,
  });
  await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
}

export async function getChat(chatId: string, userId: string) {
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!chat) return null;
  return {
    id: chat.id,
    personaId: chat.personaId,
messages: chat.messages.map((m: (typeof chat.messages)[number]) => ({
  id: m.id,
  role: m.role as "user" | "assistant",
  parts: m.parts as UIMessage["parts"],
})),
  };
}

export async function listChats(userId: string) {
  return prisma.chat.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, personaId: true, updatedAt: true },
    take: 50,
  });
}

export type ChatRow = Awaited<ReturnType<typeof listChats>>[number];