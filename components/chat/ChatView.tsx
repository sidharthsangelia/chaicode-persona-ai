"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { getPersonaMeta, DEFAULT_PERSONA_ID } from "@/lib/personas";
import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { ChatComposer } from "./ChatComposer";

export function ChatView() {
  const [personaId, setPersonaId] = useState(DEFAULT_PERSONA_ID);
  const persona = getPersonaMeta(personaId);

  const { messages, sendMessage, status, setMessages } = useChat();
  const isStreaming = status === "streaming" || status === "submitted";
  const isThinking = isStreaming && (messages.length === 0 || messages.at(-1)?.role === "user");

  function handleSend(text: string) {
    sendMessage({ text }, { body: { personaId } });
  }

  function handlePersonaChange(nextId: string) {
    setPersonaId(nextId);
    setMessages([]);
  }

  return (
    <div className="flex h-dvh flex-1 flex-col bg-background">
      <ChatHeader
        persona={persona}
        personaId={personaId}
        onPersonaChange={handlePersonaChange}
        disabled={isStreaming}
      />
      <ChatMessages
        messages={messages}
        persona={persona}
        isThinking={isThinking}
        onSuggestionClick={handleSend}
      />
      <div className="border-t bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <ChatComposer
          onSend={handleSend}
          isStreaming={isStreaming}
          placeholder={`Message ${persona.shortName}...`}
        />
      </div>
    </div>
  );
}