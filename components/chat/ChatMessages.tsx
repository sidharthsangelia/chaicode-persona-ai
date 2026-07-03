"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Marker, MarkerContent } from "@/components/ui/marker";
import { Spinner } from "@/components/ui/spinner";
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

import type { UIMessage } from "ai";
import type { PersonaMeta } from "@/lib/personas";
import { ChatEmptyState } from "./ChatEmptyState";
import { Streamdown } from "streamdown";

interface ChatMessagesProps {
  messages: UIMessage[];
  persona: PersonaMeta;
  isThinking: boolean;
  onSuggestionClick: (text: string) => void;
}

export function ChatMessages({
  messages,
  persona,
  isThinking,
  onSuggestionClick,
}: ChatMessagesProps) {
  if (messages.length === 0) {
    return (
      <ChatEmptyState persona={persona} onSuggestionClick={onSuggestionClick} />
    );
  }

  return (
    <MessageScrollerProvider
      autoScroll
      defaultScrollPosition="last-anchor"
      scrollPreviousItemPeek={64}
    >
      <MessageScroller className="flex-1">
        <MessageScrollerViewport className="pb-2">
          <MessageScrollerContent
            className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6"
            aria-busy={isThinking}
          >
            {messages.map((message) => {
              const isUser = message.role === "user";
              const text = message.parts
                .filter((p) => p.type === "text")
                .map((p) => p.text)
                .join("");

              return (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={isUser}
                >
                  <Message align={isUser ? "end" : "start"} className="gap-3">
                    {!isUser && (
                      <MessageAvatar>
                        <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={persona.avatar} />
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
                   <BubbleContent className="text-[15px] leading-7">
  {isUser ? <span className="whitespace-pre-wrap break-words">{text}</span> : <Streamdown>{text}</Streamdown>}
</BubbleContent>

                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              );
            })}

            {isThinking && (
              <MessageScrollerItem messageId="typing-marker">
                <Message align="start" className="gap-3">
                  <MessageAvatar>
                    <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={persona.avatar} />
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
                      <Spinner className="h-3.5 w-3.5" />
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
  );
}
