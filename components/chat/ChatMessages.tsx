"use client";

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import type { ChatMessage } from "@/lib/chat/messages";
import type { PersonaMeta } from "@/lib/personas";
import type { RagStatus } from "@/lib/rag/status";
import { AssistantMessage } from "./AssistantMessage";
import { ChatEmptyState } from "./ChatEmptyState";
import { UserMessage } from "./UserMessage";

interface ChatMessagesProps {
  messages: ChatMessage[];
  persona: PersonaMeta;
  isStreaming: boolean;
  /** Latest retrieval-pipeline stage, or null when nothing is in flight. */
  ragStatus: RagStatus | null;
  courseMode: boolean;
  chatId?: string;
  onSuggestionClick: (text: string) => void;
  onEditMessage: (messageId: string, newText: string) => void;
  onRegenerate: (messageId: string) => void;
}

const PENDING_ID = "__pending-assistant__";

function textOf(message: ChatMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function ChatMessages({
  messages,
  persona,
  isStreaming,
  ragStatus,
  courseMode,
  chatId,
  onSuggestionClick,
  onEditMessage,
  onRegenerate,
}: ChatMessagesProps) {
  if (messages.length === 0) {
    return (
      <ChatEmptyState
        persona={persona}
        courseMode={courseMode}
        onSuggestionClick={onSuggestionClick}
      />
    );
  }

  const lastMessage = messages[messages.length - 1];
  const needsPendingPlaceholder =
    isStreaming && (!lastMessage || lastMessage.role === "user");

  // The placeholder lives in the same slot the real assistant message will
  // occupy, so the dots -> text transition happens inside one continuous
  // bubble instead of swapping DOM nodes.
  const displayMessages: ChatMessage[] = needsPendingPlaceholder
    ? [...messages, { id: PENDING_ID, role: "assistant", parts: [] }]
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
          <MessageScrollerContent className="mx-auto flex w-full max-w-3xl flex-col px-4 py-6">
            {displayMessages.map((message, index) => {
              const text = textOf(message);

              if (message.role === "user") {
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
                      onEditSubmit={onEditMessage}
                    />
                  </MessageScrollerItem>
                );
              }

              const isPending = message.id === PENDING_ID;
              const isLastAssistant = message.id === lastAssistantId;
              const isActive = isPending || isLastAssistant;
              const hasText = text.trim().length > 0;
              const showDots = isStreaming && isActive && !hasText;

              const previous = displayMessages[index - 1];

              return (
                // Keyed by slot, not message id, so the pending placeholder
                // and the real streamed message reuse the same DOM node
                // once the id swaps in — that's what removes the jump cut.
                <MessageScrollerItem
                  // biome-ignore lint/suspicious/noArrayIndexKey: the index IS the slot, and reusing the node is the point
                  key={`slot-${index}`}
                  messageId={message.id}
                >
                  <AssistantMessage
                    message={message}
                    text={text}
                    persona={persona}
                    showAvatar={!previous || previous.role !== "assistant"}
                    isPending={isPending}
                    showDots={showDots}
                    showCursor={isStreaming && isActive && hasText}
                    // Passed only to the message actually showing dots. Handing
                    // it to every message would re-render the whole list each
                    // time the pipeline reports a new stage.
                    ragStatus={showDots ? ragStatus : null}
                    showActions={!isStreaming && !isPending}
                    canRegenerate={isLastAssistant}
                    onRegenerate={onRegenerate}
                  />
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
