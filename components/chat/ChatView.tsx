"use client";

import { useState, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { useUser } from "@clerk/nextjs";
import { getPersonaMeta, DEFAULT_PERSONA_ID } from "@/lib/personas";
import { GUEST_MESSAGE_LIMIT } from "@/lib/chat/guestLimit";
import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { ChatComposer } from "./ChatComposer";
import { GuestLimitBanner } from "./GuestLimitBanner";
import type { UIMessage } from "ai";
import { useRouter } from "next/navigation";

interface ChatViewProps {
  chatId?: string;
  initialMessages?: UIMessage[];
  initialPersonaId?: string;
}

export function ChatView({ chatId, initialMessages, initialPersonaId }: ChatViewProps) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();

  const [personaId, setPersonaId] = useState(initialPersonaId ?? DEFAULT_PERSONA_ID);
  const persona = getPersonaMeta(personaId);

  const [pendingChatId] = useState(() => chatId ?? crypto.randomUUID());

  const { messages, sendMessage, status, setMessages } = useChat({
    id: chatId ?? pendingChatId,
    messages: initialMessages,
    onFinish: () => {
      if (isLoaded && isSignedIn && !chatId) {
        window.history.replaceState(null, "", `/chat/${pendingChatId}`);
      }
    },
  });

  const isStreaming = status === "streaming" || status === "submitted";
  const isThinking = isStreaming && (messages.length === 0 || messages.at(-1)?.role === "user");

  const userMessageCount = useMemo(() => messages.filter((m) => m.role === "user").length, [messages]);
  const guestLimitReached = !isSignedIn && userMessageCount >= GUEST_MESSAGE_LIMIT;

  function handleSend(text: string) {
    if (guestLimitReached) return;
    sendMessage({ text }, { body: { personaId, chatId: chatId ?? pendingChatId } });
  }

  function handlePersonaChange(nextId: string) {
    if (chatId) {
      router.push("/");
      return;
    }
    setPersonaId(nextId);
    setMessages([]);
  }

  return (
    <div className="flex h-dvh flex-1 flex-col bg-background">
      <ChatHeader
        persona={persona}
        personaId={personaId}
        onPersonaChange={handlePersonaChange}
        disabled={isStreaming || Boolean(chatId)}
      />
      <ChatMessages messages={messages} persona={persona} isThinking={isThinking} onSuggestionClick={handleSend} />
      <div className="border-t bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        {guestLimitReached ? (
          <GuestLimitBanner />
        ) : (
          <ChatComposer onSend={handleSend} isStreaming={isStreaming} placeholder={`Message ${persona.shortName}...`} />
        )}
      </div>
    </div>
  );
}