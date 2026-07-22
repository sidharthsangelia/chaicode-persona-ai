import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { ChatView } from "@/components/chat/ChatView";
import { getChat } from "@/lib/chat/store";

export default async function ChatByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();

  // proxy.ts guards this route, so userId is set in practice. Checking anyway,
  // because Prisma drops `undefined` filters instead of matching null: passing
  // an absent userId into getChat would return whoever's chat had this id.
  if (!userId) notFound();

  const chat = await getChat(id, userId);
  if (!chat) notFound();

  return (
    <ChatView
      key={chat.id}
      chatId={chat.id}
      initialMessages={chat.messages}
      initialPersonaId={chat.personaId}
    />
  );
}
