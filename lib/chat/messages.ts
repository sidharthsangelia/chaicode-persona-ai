import type { UIMessage } from "ai";
import type { Citation } from "@/lib/rag/citations";
import type { RagStatus } from "@/lib/rag/status";

/**
 * The message shape shared by the chat route and the chat UI.
 *
 * Every import here is type-only on purpose: this module is imported by client
 * components, and a value import from lib/rag would pull Prisma and the Qdrant
 * client into the browser bundle.
 */

// A type alias, not an interface: `UIDataTypes` is `Record<string, unknown>`,
// and only an alias gets the implicit index signature that satisfies it.
export type ChatDataParts = {
  /**
   * Progress ticker. Sent transient, so it drives the waiting state and is
   * never written into the message — replaying "Searching the transcripts…"
   * under a finished answer would be nonsense.
   */
  status: RagStatus;
  /**
   * Sources the model actually cited, validated. Persisted with the message so
   * the citations survive a reload.
   */
  citations: Citation[];
};

export type ChatMessage = UIMessage<unknown, ChatDataParts>;
