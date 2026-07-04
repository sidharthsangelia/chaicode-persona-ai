"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import {
  MessageScroller, MessageScrollerButton, MessageScrollerContent,
  MessageScrollerItem, MessageScrollerProvider, MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import type { UIMessage } from "ai";
import type { PersonaMeta } from "@/lib/personas";
import { ChatEmptyState } from "./ChatEmptyState";
 
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import type { YouTubeResult } from "@/lib/ai/tools/youtube";
import { MessageActions } from "./MessageAction";
import { YouTubeResults } from "./YoutubeResults";
import { YouTubeResultsSkeleton } from "./YoutubeResultsSkeleton";
import { UserMessage } from "./UserMessage";

interface ChatMessagesProps {
  messages: UIMessage[];
  persona: PersonaMeta;
  isThinking: boolean;
  isStreaming: boolean;
  chatId?: string;
  onSuggestionClick: (text: string) => void;
  onEditMessage: (messageId: string, newText: string) => void;
  onRegenerate: (messageId: string) => void;
}

export function ChatMessages({
  messages, persona, isThinking, isStreaming, chatId,
  onSuggestionClick, onEditMessage, onRegenerate,
}: ChatMessagesProps) {
  if (messages.length === 0) {
    return <ChatEmptyState persona={persona} onSuggestionClick={onSuggestionClick} />;
  }

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="last-anchor" scrollPreviousItemPeek={64}>
      <MessageScroller className="flex-1">
        <MessageScrollerViewport>
          <MessageScrollerContent className="mx-auto flex w-full max-w-4xl flex-col px-4 py-8" aria-busy={isThinking}>
            {messages.map((message) => {
              const isUser = message.role === "user";
              const text = message.parts.filter((p) => p.type === "text").map((p) => p.text).join("");
              const isLastAssistant = message.id === lastAssistantId;

              if (isUser) {
                return (
                  <MessageScrollerItem key={message.id} messageId={message.id} scrollAnchor>
                    <UserMessage
                      message={message}
                      text={text}
                      chatId={chatId}
                      disabled={isStreaming}
                      onEditSubmit={(newText) => onEditMessage(message.id, newText)}
                    />
                  </MessageScrollerItem>
                );
              }

              return (
                <MessageScrollerItem key={message.id} messageId={message.id}>
                  <div className="group flex gap-4 py-8">
                    <Avatar className="mt-1 h-8 w-8 shrink-0">
                      <AvatarImage src={persona.avatar} />
                      <AvatarFallback className="text-xs font-semibold">{persona.initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className={cn("prose prose-neutral dark:prose-invert max-w-none text-[15px] leading-8")}>
                        <Streamdown>{text}</Streamdown>
                      </div>

                      {message.parts.map((part, i) => {
                        if (part.type !== "tool-searchYouTube") return null;
                        if (part.state === "input-streaming" || part.state === "input-available") {
                          return <YouTubeResultsSkeleton key={i} />;
                        }
                        if (part.state === "output-available") {
                          const output = part.output as { results?: YouTubeResult[]; error?: string };
                          if (output.error) return null;
                          return <YouTubeResults key={i} results={output.results ?? []} />;
                        }
                        return null;
                      })}

                      {!isStreaming && (
                        <MessageActions
                          onCopy={() => navigator.clipboard.writeText(text)}
                          onRegenerate={isLastAssistant ? () => onRegenerate(message.id) : undefined}
                          className="mt-2 opacity-0 transition-opacity group-hover:opacity-100"
                        />
                      )}
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
                    <AvatarFallback className="text-xs font-semibold">{persona.initials}</AvatarFallback>
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