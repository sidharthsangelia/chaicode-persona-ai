import "server-only";
import { prisma } from "@/lib/prisma";
import type { ChatMessage } from "./messages";

/** Clerk owns identity; this row exists only so chats have something to hang off. */
async function ensureUser(userId: string) {
  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId },
    update: {},
  });
}

/**
 * Claims `chatId` for this user, creating the row on the first turn.
 *
 * Returns false when the id already belongs to someone else. That check is the
 * whole point: /api/chat takes the chat id from the request body, so without it
 * a crafted id would append messages to a stranger's conversation.
 *
 * This runs before every answer, so the common case is deliberately one read.
 * The user upsert only happens on the turn that actually creates the chat,
 * rather than putting a write on the hot path for the whole conversation.
 */
export async function ensureChat({
  chatId,
  userId,
  personaId,
  firstUserText,
}: {
  chatId: string;
  userId: string;
  personaId: string;
  firstUserText: string;
}): Promise<boolean> {
  const existing = await prisma.chat.findUnique({
    where: { id: chatId },
    select: { userId: true },
  });
  if (existing) return existing.userId === userId;

  await ensureUser(userId);

  // skipDuplicates compiles to ON CONFLICT DO NOTHING, so an id claimed between
  // the read above and this insert loses quietly instead of throwing.
  const { count } = await prisma.chat.createMany({
    data: [
      { id: chatId, userId, personaId, title: firstUserText.slice(0, 60) },
    ],
    skipDuplicates: true,
  });
  if (count === 1) return true;

  // Lost the race. It may still be ours (a double-submitted first message), so
  // ask rather than assume.
  const mine = await prisma.chat.findFirst({
    where: { id: chatId, userId },
    select: { id: true },
  });
  return mine !== null;
}

export async function saveTurn({
  chatId,
  messages,
}: {
  chatId: string;
  messages: ChatMessage[];
}) {
  await prisma.message.createMany({
    data: messages.map((m) => ({
      id: m.id,
      chatId,
      role: m.role,
      parts: m.parts as object,
    })),
    skipDuplicates: true,
  });
  await prisma.chat.update({
    where: { id: chatId },
    data: { updatedAt: new Date() },
  });
}

/**
 * How many messages a chat page hydrates with.
 *
 * Every one of these carries its full parts JSON into the RSC payload, so an
 * uncapped read makes opening a long conversation slower the longer it gets.
 * The answer step only ever reads the last 20 turns anyway.
 */
const MESSAGE_WINDOW = 100;

export async function getChat(chatId: string, userId: string) {
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId },
    select: {
      id: true,
      personaId: true,
      // Newest first so `take` keeps the recent end of the conversation, then
      // reversed below into the order the transcript reads in.
      messages: {
        orderBy: { createdAt: "desc" },
        take: MESSAGE_WINDOW,
        select: { id: true, role: true, parts: true },
      },
    },
  });
  if (!chat) return null;
  return {
    id: chat.id,
    personaId: chat.personaId,
    messages: chat.messages.reverse().map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      parts: m.parts as ChatMessage["parts"],
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
