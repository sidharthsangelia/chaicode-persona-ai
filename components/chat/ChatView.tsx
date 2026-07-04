"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { useUser } from "@clerk/nextjs";
import { getPersonaMeta, DEFAULT_PERSONA_ID } from "@/lib/personas";
import { GUEST_MESSAGE_LIMIT } from "@/lib/chat/guestLimit";
import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { ChatComposer } from "./ChatComposer";
import { GuestLimitBanner } from "./GuestLimitBanner";
import type { UIMessage } from "ai";

interface ChatViewProps {
  chatId?: string;
  initialMessages?: UIMessage[];
  initialPersonaId?: string;
}

export function ChatView({
  chatId,
  initialMessages,
  initialPersonaId,
}: ChatViewProps) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();

  const [personaId, setPersonaId] = useState(
    initialPersonaId ?? DEFAULT_PERSONA_ID,
  );
  const persona = getPersonaMeta(personaId);

  const [pendingChatId] = useState(() => chatId ?? crypto.randomUUID());
  // Tracks whether THIS chat has already been written to the DB, even though
  // `chatId` (the prop) stays undefined for the lifetime of this component —
  // we never actually navigate to /chat/[id], we only swap the URL bar.
  const [hasStartedChat, setHasStartedChat] = useState(Boolean(chatId));

  const { messages, sendMessage, status, setMessages, regenerate } = useChat({
    id: chatId ?? pendingChatId,
    messages: initialMessages,
    onFinish: () => {
      if (isLoaded && isSignedIn && !chatId) {
        window.history.replaceState(null, "", `/chat/${pendingChatId}`);
        setHasStartedChat(true);
        router.refresh(); // re-renders AppSidebar (Server Component) with the new chat row
      }
    },
  });

  const isStreaming = status === "streaming" || status === "submitted";
  const isThinking =
    isStreaming && (messages.length === 0 || messages.at(-1)?.role === "user");

  const userMessageCount = useMemo(
    () => messages.filter((m) => m.role === "user").length,
    [messages],
  );
  const guestLimitReached =
    !isSignedIn && userMessageCount >= GUEST_MESSAGE_LIMIT;

  function handleSend(text: string) {
    if (guestLimitReached) return;
    sendMessage(
      { text },
      { body: { personaId, chatId: chatId ?? pendingChatId } },
    );
  }

  function handlePersonaChange(nextId: string) {
    if (chatId || hasStartedChat) {
      // This "chat" is already saved under pendingChatId — reusing it for a
      // different persona would corrupt ensureChat's persona/title. Force a
      // real reload so a fresh pendingChatId gets generated.
      window.location.assign("/");
      return;
    }
    setPersonaId(nextId);
    setMessages([]);
  }

  async function handleRegenerate(messageId: string) {
    if (chatId ?? pendingChatId) {
      const { pruneMessagesFromAction } = await import("@/actions/chatActions");
      await pruneMessagesFromAction(chatId ?? pendingChatId, messageId);
    }
    regenerate({ messageId });
  }

  function handleEditMessage(messageId: string, newText: string) {
    const index = messages.findIndex((m) => m.id === messageId);
    if (index === -1) return;

    setMessages([
      ...messages.slice(0, index),
      { ...messages[index], parts: [{ type: "text", text: newText }] },
    ]);
    regenerate();
  }
  return (
    <div className="flex h-dvh flex-1 flex-col bg-background">
      <ChatHeader
        persona={persona}
        personaId={personaId}
        onPersonaChange={handlePersonaChange}
        disabled={isStreaming || chatId !== undefined || hasStartedChat}
      />
      <ChatMessages
        messages={messages}
        persona={persona}
        isThinking={isThinking}
        isStreaming={isStreaming}
        chatId={chatId}
        onSuggestionClick={handleSend}
        onEditMessage={handleEditMessage}
        onRegenerate={handleRegenerate}
      />
      <div className="border-t bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        {guestLimitReached ? (
          <GuestLimitBanner />
        ) : (
          <ChatComposer
            onSend={handleSend}
            isStreaming={isStreaming}
            placeholder={`Message ${persona.shortName}...`}
          />
        )}
      </div>
    </div>
  );
}
