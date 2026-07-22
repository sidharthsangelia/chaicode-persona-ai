"use client";

import { memo, useState } from "react";
import { toast } from "sonner";
import { pruneMessagesFromAction } from "@/actions/chatActions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ChatMessage } from "@/lib/chat/messages";
import { MessageActions } from "./MessageAction";

interface UserMessageProps {
  message: ChatMessage;
  text: string;
  chatId?: string;
  disabled: boolean;
  /** Takes the id so ChatView can hand down one stable callback for every row. */
  onEditSubmit: (messageId: string, newText: string) => void;
}

/**
 * Memoised for the same reason as AssistantMessage: a streaming answer
 * re-renders the list on every token, and none of these change while it does.
 */
export const UserMessage = memo(function UserMessage({
  message,
  text,
  chatId,
  disabled,
  onEditSubmit,
}: UserMessageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  function cancel() {
    setDraft(text);
    setIsEditing(false);
  }

  async function handleSubmit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === text) {
      cancel();
      return;
    }

    if (chatId) {
      const result = await pruneMessagesFromAction(chatId, message.id);
      if (result?.error) {
        toast.error("Couldn't edit this message right now.");
        return;
      }
    }

    setIsEditing(false);
    onEditSubmit(message.id, trimmed);
  }

  if (isEditing) {
    return (
      <div className="flex justify-end py-4">
        <div className="w-full max-w-[75%] space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            className="min-h-20 resize-none rounded-2xl"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
              if (e.key === "Escape") cancel();
            }}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={cancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit}>
              Save & submit
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex flex-col items-end py-4">
      <div className="max-w-[75%] rounded-3xl border bg-muted px-5 py-3 text-[15px] leading-7">
        <span className="whitespace-pre-wrap break-words">{text}</span>
      </div>
      <MessageActions
        onCopy={() => navigator.clipboard.writeText(text)}
        onEdit={disabled ? undefined : () => setIsEditing(true)}
        className="mt-1 opacity-0 transition-opacity group-hover:opacity-100"
      />
    </div>
  );
});
