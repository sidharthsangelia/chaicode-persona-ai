// app/chat/page.tsx
"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Marker, MarkerContent } from "@/components/ui/marker";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUp } from "lucide-react";
import { PERSONAS, DEFAULT_PERSONA_ID, getPersonaMeta } from "@/lib/personas";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [personaId, setPersonaId] = useState(DEFAULT_PERSONA_ID);

  const persona = getPersonaMeta(personaId);

  const { messages, sendMessage, status, setMessages } = useChat();

  const isStreaming =
    status === "streaming" || status === "submitted";

  const showTypingMarker =
    isStreaming &&
    (messages.length === 0 ||
      messages[messages.length - 1].role === "user");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!input.trim() || isStreaming) return;

    sendMessage(
      { text: input },
      {
        body: {
          personaId,
        },
      },
    );

    setInput("");
  }

  function handlePersonaChange(nextId: string) {
    setPersonaId(nextId);
    setMessages([]);
  }

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="text-xs font-semibold">
              {persona.initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">
              {persona.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {persona.tagline}
            </p>
          </div>
        </div>

        <Select
          value={personaId}
          onValueChange={handlePersonaChange}
          disabled={isStreaming}
        >
          <SelectTrigger className="h-9 w-44 rounded-xl">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            {Object.values(PERSONAS).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.shortName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      {/* Messages */}
      <MessageScrollerProvider autoScroll>
        <MessageScroller>
          <MessageScrollerViewport className="pb-2">
            <MessageScrollerContent className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
              {messages.map((message) => {
                const isUser = message.role === "user";

                return (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={message.id}
                    scrollAnchor={isUser}
                  >
                    <Message
                      align={isUser ? "end" : "start"}
                      className="gap-3"
                    >
                      {!isUser && (
                        <MessageAvatar>
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="text-xs font-semibold">
                              {persona.initials}
                            </AvatarFallback>
                          </Avatar>
                        </MessageAvatar>
                      )}

                      <MessageContent>
                        <Bubble
                          variant={isUser ? "tinted" : "muted"}
                          className="max-w-[85%] rounded-2xl shadow-sm"
                        >
                          <BubbleContent>
                            {message.parts.map((part, i) =>
                              part.type === "text" ? (
                                <span
                                  key={i}
                                  className="whitespace-pre-wrap break-words text-[15px] leading-7"
                                >
                                  {part.text}
                                </span>
                              ) : null,
                            )}
                          </BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                );
              })}

              {showTypingMarker && (
                <MessageScrollerItem messageId="typing-marker">
                  <Message align="start" className="gap-3">
                    <MessageAvatar>
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-xs font-semibold">
                          {persona.initials}
                        </AvatarFallback>
                      </Avatar>
                    </MessageAvatar>

                    <MessageContent>
                      <Marker
                        role="status"
                        className="rounded-full px-3 py-2 text-sm"
                      >
                        <MarkerContent>
                          {persona.shortName} is thinking...
                        </MarkerContent>
                      </Marker>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>

          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="border-t bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      >
        <div className="flex items-end gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ${persona.shortName}...`}
            disabled={isStreaming}
            className="h-11 rounded-xl border-muted-foreground/20 px-4 shadow-none focus-visible:ring-1"
          />

          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isStreaming}
            className="h-11 w-11 shrink-0 rounded-xl"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}