import { auth } from "@clerk/nextjs/server";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from "ai";
import { streamAnswer } from "@/lib/ai/answer";
import { countUserMessages, GUEST_MESSAGE_LIMIT } from "@/lib/chat/guestLimit";
import type { ChatMessage } from "@/lib/chat/messages";
import { ensureChat, saveTurn } from "@/lib/chat/store";
import { applyCitationFilter, createCitationFilter } from "@/lib/rag/citations";
import { runRetrievalPipeline } from "@/lib/rag/pipeline";
import { describeStage, INITIAL_STATUS } from "@/lib/rag/status";
import type { ChatTurn } from "@/lib/rag/types";

/**
 * Retrieval runs before generation, so this route is slower than a plain chat
 * completion — roughly 5s of routing, searching and grading before the first
 * token on a course question. Vercel Fluid Compute allows 300s, so no background
 * job is needed; the wait is covered by streaming the pipeline's progress to the
 * UI instead of showing a spinner.
 */
export const maxDuration = 60;

/** How many prior turns to carry. Bounds both prompt size and RAG history. */
const HISTORY_WINDOW = 20;

function textOf(message: ChatMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export async function POST(req: Request) {
  const { userId } = await auth();
  const {
    messages,
    personaId,
    chatId,
    courseMode,
  }: {
    messages: ChatMessage[];
    personaId?: string;
    chatId?: string;
    /** Set by the /course toggle in the composer. */
    courseMode?: boolean;
  } = await req.json();

  if (!userId) {
    if (countUserMessages(messages) > GUEST_MESSAGE_LIMIT) {
      return new Response("Guest limit reached. Sign in to keep chatting.", {
        status: 403,
      });
    }
  } else if (chatId) {
    const firstUserText =
      messages
        .find((m) => m.role === "user")
        ?.parts.find((p) => p.type === "text")?.text ?? "New chat";
    const owned = await ensureChat({
      chatId,
      userId,
      personaId: personaId ?? "hitesh",
      firstUserText,
    });
    // The id came from the request body, so it can name a chat this user does
    // not own. Refuse loudly rather than streaming an answer that onFinish
    // would then try to write into somebody else's thread.
    if (!owned) return new Response("Not found", { status: 404 });
  }

  // The last USER message, not the last message: regenerating leaves an
  // assistant turn on the end, and the pipeline needs the question either way.
  const questionIndex = messages.findLastIndex((m) => m.role === "user");
  const question = questionIndex === -1 ? "" : textOf(messages[questionIndex]);
  const history: ChatTurn[] = messages
    .slice(0, questionIndex)
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as ChatTurn["role"], text: textOf(m) }));

  const stream = createUIMessageStream<ChatMessage>({
    originalMessages: messages,
    onError: (error) => {
      console.error("[chat] stream failed:", error);
      return "Kuch toh gadbad ho gayi mere end pe. Ek baar dobara try karo?";
    },
    execute: async ({ writer }) => {
      // Written before routing so the UI has something to say during the first
      // second, which is otherwise dead air.
      writer.write({
        type: "data-status",
        data: INITIAL_STATUS,
        transient: true,
      });

      const pipeline = await runRetrievalPipeline(question, {
        history,
        courseMode: courseMode === true,
        signal: req.signal,
        onEvent: (event) => {
          const status = describeStage(event);
          if (status) {
            // Transient: progress is for the wait, not for the transcript.
            writer.write({
              type: "data-status",
              data: status,
              transient: true,
            });
          }
        },
      });

      // Prior assistant turns still carry their `[1]` markers, which is fine —
      // it reinforces the format, and the filter below renumbers against THIS
      // turn's sources, so a stale number can never resolve to a stale citation.
      const modelMessages = await convertToModelMessages(
        messages.slice(-HISTORY_WINDOW),
      );

      const { plan, result } = streamAnswer({
        personaId,
        messages: modelMessages,
        pipeline,
        signal: req.signal,
      });

      // Routes without sources have nothing to validate, and GENERAL has a tool
      // whose parts the text-only path would drop. Pass those through whole.
      if (plan.sources.length === 0) {
        writer.merge(toUIMessageStream({ stream: result.stream }));
        return;
      }

      const filter = createCitationFilter(plan.sources);
      const textId = "answer";

      writer.write({ type: "text-start", id: textId });
      for await (const delta of applyCitationFilter(
        result.textStream,
        filter,
      )) {
        writer.write({ type: "text-delta", id: textId, delta });
      }
      writer.write({ type: "text-end", id: textId });

      // Only what survived validation, and only after the text that cites it.
      const citations = filter.citations();
      if (citations.length > 0) {
        writer.write({ type: "data-citations", data: citations });
      }
    },
    onFinish: async ({ messages: finalMessages }) => {
      if (!userId || !chatId) return;
      await saveTurn({ chatId, messages: finalMessages.slice(-2) });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
