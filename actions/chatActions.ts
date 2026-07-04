"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
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

  const { count } = await prisma.chat.deleteMany({ where: { id: chatId, userId } });
  if (count === 0) return { error: "Chat not found" };

  revalidatePath("/", "layout");
  return { success: true as const };
}