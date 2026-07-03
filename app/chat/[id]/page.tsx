import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getChat } from "@/lib/chat/store";
import { ChatView } from "@/components/chat/ChatView";


export default async function ChatByIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth(); 

  const chat = await getChat(id, userId!);
  if (!chat) notFound();

  return <ChatView chatId={chat.id} initialMessages={chat.messages} initialPersonaId={chat.personaId} />;
}