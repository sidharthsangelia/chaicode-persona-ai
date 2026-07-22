"use client";

import { memo } from "react";
import { Streamdown } from "streamdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { YouTubeResult } from "@/lib/ai/tools/youtube";
import type { ChatMessage } from "@/lib/chat/messages";
import type { PersonaMeta } from "@/lib/personas";
import type { RagStatus } from "@/lib/rag/status";
import { cn } from "@/lib/utils";
import { CourseCitations } from "./CourseCitations";
import { MessageActions } from "./MessageAction";
import { YouTubeResults } from "./YoutubeResults";
import { YouTubeResultsSkeleton } from "./YoutubeResultsSkeleton";

/**
 * The wait before the first token.
 *
 * On a course question that wait is around five seconds of routing, searching
 * and grading, which is long enough that bare dots read as a hang. The pipeline
 * streams what it is actually doing, so the dots get a caption.
 */
function TypingIndicator({
  label,
  status,
}: {
  label: string;
  status: RagStatus | null;
}) {
  return (
    <output className="flex h-6 items-center gap-2">
      <span className="sr-only">{status?.label ?? label}</span>
      <div className="flex items-center gap-1" aria-hidden>
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" />
      </div>
      {status && (
        <span
          // Keyed by label so each new stage fades in rather than swapping text.
          key={status.label}
          className="animate-in fade-in text-xs text-muted-foreground duration-300"
          aria-hidden
        >
          {status.label}
        </span>
      )}
    </output>
  );
}

interface AssistantMessageProps {
  message: ChatMessage;
  /** Concatenated text parts, computed once by the parent. */
  text: string;
  persona: PersonaMeta;
  showAvatar: boolean;
  /** The placeholder that holds the slot until the real message arrives. */
  isPending: boolean;
  showDots: boolean;
  showCursor: boolean;
  /** Only ever non-null on the message currently showing dots. */
  ragStatus: RagStatus | null;
  showActions: boolean;
  /** Regenerate is offered on the newest answer only. */
  canRegenerate: boolean;
  /** Must be referentially stable, or the memo below never hits. */
  onRegenerate: (messageId: string) => void;
}

/**
 * Memoised because a streaming answer re-renders this list roughly thirty times
 * a second, and without it every earlier message re-runs its markdown parse on
 * every token. Only the last message's `text` actually changes, so everything
 * above it compares equal and skips.
 *
 * That only holds while the callbacks above stay referentially stable, which is
 * why ChatView wraps them in useCallback.
 */
export const AssistantMessage = memo(function AssistantMessage({
  message,
  text,
  persona,
  showAvatar,
  isPending,
  showDots,
  showCursor,
  ragStatus,
  showActions,
  canRegenerate,
  onRegenerate,
}: AssistantMessageProps) {
  return (
    <div className="group flex gap-4 py-6 animate-in fade-in duration-300">
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
            status={ragStatus}
          />
        ) : (
          <div
            className={cn(
              "prose prose-neutral dark:prose-invert max-w-none text-[15px] leading-7 transition-opacity duration-150",
              showCursor &&
                "after:ml-0.5 after:inline-block after:h-4 after:w-[2px] after:translate-y-0.5 after:animate-pulse after:bg-foreground/70 after:content-['']",
            )}
          >
            <Streamdown>{text}</Streamdown>
          </div>
        )}

        {!isPending &&
          message.parts.map((part, i) => {
            // Citations arrive after the text that references them, so they
            // render below it by construction.
            if (part.type === "data-citations") {
              return (
                <CourseCitations
                  key={`${message.id}-cite-${i}`}
                  citations={part.data}
                />
              );
            }

            if (part.type !== "tool-searchYouTube") return null;
            if (
              part.state === "input-streaming" ||
              part.state === "input-available"
            ) {
              return <YouTubeResultsSkeleton key={`${message.id}-yt-${i}`} />;
            }
            if (part.state === "output-available") {
              const output = part.output as {
                results?: YouTubeResult[];
                error?: string;
              };
              if (output.error) return null;
              return (
                <YouTubeResults
                  key={`${message.id}-yt-${i}`}
                  results={output.results ?? []}
                />
              );
            }
            return null;
          })}

        {showActions && (
          <MessageActions
            onCopy={() => navigator.clipboard.writeText(text)}
            onRegenerate={
              canRegenerate ? () => onRegenerate(message.id) : undefined
            }
            className="mt-2 translate-y-1 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100"
          />
        )}
      </div>
    </div>
  );
});
