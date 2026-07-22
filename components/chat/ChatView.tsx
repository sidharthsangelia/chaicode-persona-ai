"use client";

import { useChat } from "@ai-sdk/react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { importGuestChatAction } from "@/actions/chatActions";
import { useActiveChat } from "@/lib/chat/activeChatContext";
import {
  clearGuestDraft,
  loadGuestDraft,
  saveGuestDraft,
} from "@/lib/chat/guestDraft";
import { GUEST_MESSAGE_LIMIT } from "@/lib/chat/guestLimit";
import type { ChatMessage } from "@/lib/chat/messages";
import { DEFAULT_PERSONA_ID, getPersonaMeta } from "@/lib/personas";
import type { RagStatus } from "@/lib/rag/status";
import { ChatComposer } from "./ChatComposer";
import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { GuestLimitBanner } from "./GuestLimitBanner";

interface ChatViewProps {
  chatId?: string;
  initialMessages?: ChatMessage[];
  initialPersonaId?: string;
}

export function ChatView({
  chatId,
  initialMessages,
  initialPersonaId,
}: ChatViewProps) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const { setActiveChatId } = useActiveChat();

  const [personaId, setPersonaId] = useState(
    initialPersonaId ?? DEFAULT_PERSONA_ID,
  );
  const persona = getPersonaMeta(personaId);

  const [pendingChatId] = useState(() => chatId ?? crypto.randomUUID());
  const [hasStartedChat, setHasStartedChat] = useState(Boolean(chatId));

  // What the retrieval pipeline is doing right now. It arrives as transient
  // data parts, which by design never land in `messages` — they describe the
  // wait, not the answer — so the latest one is held here instead.
  const [ragStatus, setRagStatus] = useState<RagStatus | null>(null);

  const { messages, sendMessage, status, setMessages, regenerate } =
    useChat<ChatMessage>({
      id: chatId ?? pendingChatId,
      messages: initialMessages,
      onData: (part) => {
        if (part.type === "data-status") setRagStatus(part.data);
      },
      onFinish: () => {
        setRagStatus(null);
        if (isLoaded && isSignedIn && !chatId) {
          router.replace(`/chat/${pendingChatId}`, { scroll: false });
          setHasStartedChat(true);
        }
      },
      onError: () => setRagStatus(null),
    });

  const isStreaming = status === "streaming" || status === "submitted";

  const userMessageCount = useMemo(
    () => messages.filter((m) => m.role === "user").length,
    [messages],
  );
  const guestLimitReached =
    !isSignedIn && userMessageCount >= GUEST_MESSAGE_LIMIT;

  useEffect(() => {
    setActiveChatId(chatId ?? pendingChatId);
  }, [chatId, pendingChatId, setActiveChatId]);

  // Restore a guest draft on mount — client-only (useEffect, not a lazy
  // initializer), so it can't cause an SSR/CSR hydration mismatch. Runs
  // before the person can have typed anything new, so there's nothing on
  // the fresh random `pendingChatId` to lose by adopting the draft's id/messages.

  const hasGuestDraftToImportRef = useRef(false);

  // Restore a guest draft on mount
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (chatId || hasRestoredRef.current || messages.length > 0) return;
    const draft = loadGuestDraft();
    if (!draft || draft.messages.length === 0) return;

    hasRestoredRef.current = true;
    hasGuestDraftToImportRef.current = true; // <- only this path arms the import effect
    setMessages(draft.messages);
    if (draft.personaId !== personaId) setPersonaId(draft.personaId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist while guest, skipped mid-stream to avoid a localStorage write
  // on every streamed token (perf).
  useEffect(() => {
    if (isSignedIn || isStreaming) return;
    if (messages.length === 0) {
      clearGuestDraft();
      return;
    }
    saveGuestDraft({ pendingChatId, personaId, messages });
  }, [messages, isStreaming, isSignedIn, pendingChatId, personaId]);

  // Import into Postgres — now structurally cannot fire for an ordinary
  // signed-in new chat, only for a session that actually restored a draft.
  const hasImportedRef = useRef(false);
  useEffect(() => {
    if (!hasGuestDraftToImportRef.current) return;
    if (
      !isLoaded ||
      !isSignedIn ||
      chatId ||
      hasStartedChat ||
      hasImportedRef.current
    )
      return;
    if (messages.length === 0) return;

    hasImportedRef.current = true;
    (async () => {
      const result = await importGuestChatAction({
        chatId: pendingChatId,
        personaId,
        messages,
      });
      if (result?.error) {
        hasImportedRef.current = false;
        return;
      }
      clearGuestDraft();
      setHasStartedChat(true);
      router.replace(`/chat/${pendingChatId}`, { scroll: false });
    })();
  }, [
    isLoaded,
    isSignedIn,
    chatId,
    hasStartedChat,
    messages,
    pendingChatId,
    personaId,
    router,
  ]);

  function handleSend(text: string) {
    if (guestLimitReached) return;
    sendMessage(
      { text },
      { body: { personaId, chatId: chatId ?? pendingChatId } },
    );
  }

  function handlePersonaChange(nextId: string) {
    if (chatId || hasStartedChat) {
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
        startsNewChatOnSwitch={messages.length > 0}
      />
      <ChatMessages
        messages={messages}
        persona={persona}
        isStreaming={isStreaming}
        ragStatus={ragStatus}
        chatId={chatId}
        onSuggestionClick={handleSend}
        onEditMessage={handleEditMessage}
        onRegenerate={handleRegenerate}
      />
      <div className="bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
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
