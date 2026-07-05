"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import type { YouTubeResult } from "@/lib/ai/tools/youtube";
import { MessageActions } from "./MessageAction";
import { YouTubeResults } from "./YoutubeResults";
import { YouTubeResultsSkeleton } from "./YoutubeResultsSkeleton";
import { UserMessage } from "./UserMessage";

interface ChatMessagesProps {
  messages: UIMessage[];
  persona: PersonaMeta;
  isStreaming: boolean;
  chatId?: string;
  onSuggestionClick: (text: string) => void;
  onEditMessage: (messageId: string, newText: string) => void;
  onRegenerate: (messageId: string) => void;
}

const PENDING_ID = "__pending-assistant__";

function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex h-6 items-center gap-1" role="status">
      <span className="sr-only">{label}</span>
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" />
    </div>
  );
}

export function ChatMessages({
  messages,
  persona,
  isStreaming,
  chatId,
  onSuggestionClick,
  onEditMessage,
  onRegenerate,
}: ChatMessagesProps) {
  if (messages.length === 0) {
    return (
      <ChatEmptyState persona={persona} onSuggestionClick={onSuggestionClick} />
    );
  }

  const lastMessage = messages[messages.length - 1];
  const needsPendingPlaceholder =
    isStreaming && (!lastMessage || lastMessage.role === "user");

  // The placeholder lives in the same slot the real assistant message will
  // occupy, so the dots -> text transition happens inside one continuous
  // bubble instead of swapping DOM nodes.
  const displayMessages = needsPendingPlaceholder
    ? [
        ...messages,
        { id: PENDING_ID, role: "assistant", parts: [] } as UIMessage,
      ]
    : messages;

  const lastAssistantId = [...displayMessages]
    .reverse()
    .find((m) => m.role === "assistant")?.id;

  return (
    <MessageScrollerProvider
      autoScroll
      defaultScrollPosition="last-anchor"
      scrollPreviousItemPeek={64}
    >
      <MessageScroller className="flex-1">
        <MessageScrollerViewport>
          <MessageScrollerContent
            className="
    mx-auto
    flex
    w-full
    max-w-3xl
    flex-col
    px-4
    py-6
  "
          >
            {displayMessages.map((message, index) => {
              const isUser = message.role === "user";
              const isPending = message.id === PENDING_ID;
              const text = message.parts
                .filter((p) => p.type === "text")
                .map((p) => p.text)
                .join("");
              const isLastAssistant = message.id === lastAssistantId;
              const isActiveAssistant = isPending || isLastAssistant;

              const previousMessage = displayMessages[index - 1];
              const showAvatar =
                !previousMessage || previousMessage.role !== "assistant";

              if (isUser) {
                return (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={message.id}
                    scrollAnchor
                  >
                    <UserMessage
                      message={message}
                      text={text}
                      chatId={chatId}
                      disabled={isStreaming}
                      onEditSubmit={(newText) =>
                        onEditMessage(message.id, newText)
                      }
                    />
                  </MessageScrollerItem>
                );
              }

              const showDots =
                isStreaming && isActiveAssistant && text.trim().length === 0;
              const showCursor =
                isStreaming && isActiveAssistant && text.trim().length > 0;

              return (
                // Keyed by slot, not message id, so the pending placeholder
                // and the real streamed message reuse the same DOM node
                // once the id swaps in — that's what removes the jump cut.
                <MessageScrollerItem
                  key={`slot-${index}`}
                  messageId={message.id}
                >
                  <div
                    className="
    group
    flex
    gap-4
    py-6
    animate-in
    fade-in
    duration-300
  "
                  >
                    <div className="w-8 shrink-0">
                      {showAvatar && (
                        <Avatar className="mt-1 h-8 w-8">
                          <AvatarImage src={persona.avatar} />
                          <AvatarFallback className="text-xs font-semibold">
                            {persona.initials}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {showDots ? (
                        <TypingIndicator
                          label={`${persona.shortName} is typing`}
                        />
                      ) : (
                        <div
                          className={cn(
                            `
      prose
      prose-neutral
      dark:prose-invert
      max-w-none
      text-[15px]
      leading-7
      transition-opacity
      duration-150
    `,
                            showCursor &&
                              "after:ml-0.5 after:inline-block after:h-4 after:w-[2px] after:translate-y-0.5 after:animate-pulse after:bg-foreground/70 after:content-['']",
                          )}
                        >
                          <Streamdown>{text}</Streamdown>
                        </div>
                      )}

                      {!isPending &&
                        message.parts.map((part, i) => {
                          if (part.type !== "tool-searchYouTube") return null;
                          if (
                            part.state === "input-streaming" ||
                            part.state === "input-available"
                          ) {
                            return <YouTubeResultsSkeleton key={i} />;
                          }
                          if (part.state === "output-available") {
                            const output = part.output as {
                              results?: YouTubeResult[];
                              error?: string;
                            };
                            if (output.error) return null;
                            return (
                              <YouTubeResults
                                key={i}
                                results={output.results ?? []}
                              />
                            );
                          }
                          return null;
                        })}

                      {!isStreaming && !isPending && (
                        <MessageActions
                          onCopy={() => navigator.clipboard.writeText(text)}
                          onRegenerate={
                            isLastAssistant
                              ? () => onRegenerate(message.id)
                              : undefined
                          }
                          className="
  mt-2
  opacity-0
  translate-y-1
  transition-all
  duration-200
  group-hover:translate-y-0
  group-hover:opacity-100
"
                        />
                      )}
                    </div>
                  </div>
                </MessageScrollerItem>
              );
            })}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}