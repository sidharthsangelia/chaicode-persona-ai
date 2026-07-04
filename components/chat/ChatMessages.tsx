"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
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
import { cn } from "@/lib/utils";

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
      <ChatEmptyState
        persona={persona}
        onSuggestionClick={onSuggestionClick}
      />
    );
  }

  return (
    <MessageScrollerProvider
      autoScroll
      defaultScrollPosition="last-anchor"
      scrollPreviousItemPeek={64}
    >
      <MessageScroller className="flex-1">
        <MessageScrollerViewport>
          <MessageScrollerContent
            className="mx-auto flex w-full max-w-4xl flex-col px-4 py-8"
            aria-busy={isThinking}
          >
            {messages.map((message) => {
              const isUser = message.role === "user";

              const text = message.parts
                .filter((p) => p.type === "text")
                .map((p) => p.text)
                .join("");

              if (isUser) {
                return (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={message.id}
                    scrollAnchor
                  >
                    <div className="flex justify-end py-4">
                      <div className="max-w-[75%] rounded-3xl border bg-muted px-5 py-3 text-[15px] leading-7">
                        <span className="whitespace-pre-wrap break-words">
                          {text}
                        </span>
                      </div>
                    </div>
                  </MessageScrollerItem>
                );
              }

              return (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                >
                  <div className="flex gap-4 py-8">
                    <Avatar className="mt-1 h-8 w-8 shrink-0">
                      <AvatarImage src={persona.avatar} />
                      <AvatarFallback className="text-xs font-semibold">
                        {persona.initials}
                      </AvatarFallback>
                    </Avatar>

                    <div
                      className={cn(
                        "min-w-0 flex-1",
                        "prose prose-neutral dark:prose-invert",
                        "max-w-none"
                      )}
                    >
                      <div className="text-[15px] leading-8">
                        <Streamdown>{text}</Streamdown>
                      </div>
                    </div>
                  </div>
                </MessageScrollerItem>
              );
            })}

            {isThinking && (
              <MessageScrollerItem messageId="typing-marker">
                <div className="flex gap-4 py-8">
                  <Avatar className="mt-1 h-8 w-8 shrink-0">
                    <AvatarImage src={persona.avatar} />
                    <AvatarFallback className="text-xs font-semibold">
                      {persona.initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex h-8 items-center gap-3 text-sm text-muted-foreground">
                    <Spinner className="h-4 w-4" />
                    <span>{persona.shortName} is thinking...</span>
                  </div>
                </div>
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>

        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}