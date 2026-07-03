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
import { ArrowUp } from "lucide-react";

const PERSONA = { name: "Hitesh Choudhary", initials: "HC" };

export default function ChatPage() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat();
  const isStreaming = status === "streaming" || status === "submitted";
  // True only while we're waiting on the very first token of a new reply —
  // once text starts arriving, the Bubble itself is the "in progress" signal.
  const showTypingMarker =
    isStreaming &&
    (messages.length === 0 ||
      messages[messages.length - 1].role === "user");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    sendMessage({ text: input });
    setInput("");
  }

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col ">
      <header className="border-b px-4 py-3">
        <h1 className="text-sm font-medium">Chat with {PERSONA.name}</h1>
      </header>

      <MessageScrollerProvider autoScroll>
        <MessageScroller>
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
              {messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={message.id}
                    scrollAnchor={isUser}
                  >
                    <Message align={isUser ? "end" : "start"}>
                      {!isUser && (
                        <MessageAvatar>
                          <Avatar>
                            <AvatarFallback>{PERSONA.initials}</AvatarFallback>
                          </Avatar>
                        </MessageAvatar>
                      )}
                      <MessageContent>
                        <Bubble variant={isUser ? "tinted" : "muted"}>
                          <BubbleContent>
                            {message.parts.map((part, i) =>
                              part.type === "text" ? (
                                <span key={i} className="whitespace-pre-wrap">
                                  {part.text}
                                </span>
                              ) : null
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
                  <Message align="start">
                    <MessageAvatar>
                      <Avatar>
                        <AvatarFallback>{PERSONA.initials}</AvatarFallback>
                      </Avatar>
                    </MessageAvatar>
                    <MessageContent>
                      <Marker role="status">
                        <MarkerContent>
                          {PERSONA.name.split(" ")[0]} is thinking…
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

      <form onSubmit={handleSubmit} className="flex gap-2 border-t p-4">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message ${PERSONA.name.split(" ")[0]}…`}
          disabled={isStreaming}
        />
        <Button type="submit" size="icon" disabled={!input.trim() || isStreaming}>
          <ArrowUp className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}