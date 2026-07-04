import { getSystemPrompt } from "@/lib/ai";
import { ensureUser, ensureChat, saveTurn } from "@/lib/chat/store";
import { auth } from "@clerk/nextjs/server";
import { openai } from "@ai-sdk/openai";
import {
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { countUserMessages, GUEST_MESSAGE_LIMIT } from "@/lib/chat/guestLimit";

export async function POST(req: Request) {
  const { userId } = await auth();
  const { messages, personaId, chatId }: { messages: UIMessage[]; personaId?: string; chatId?: string } =
    await req.json();

  if (!userId) {
    if (countUserMessages(messages) > GUEST_MESSAGE_LIMIT) {
      return new Response("Guest limit reached. Sign in to keep chatting.", { status: 403 });
    }
  } else if (chatId) {
    await ensureUser(userId);
    const firstUserText =
      messages.find((m) => m.role === "user")?.parts.find((p) => p.type === "text")?.text ?? "New chat";
    await ensureChat({ chatId, userId, personaId: personaId ?? "hitesh", firstUserText });
  }

  const stream = createUIMessageStream<UIMessage>({
    originalMessages: messages,
    execute: async ({ writer }) => {
      const modelMessages = await convertToModelMessages(messages.slice(-20));

      const result = streamText({
        model: openai("gpt-4o-mini"),
        system: getSystemPrompt(personaId),
        messages: modelMessages,
        temperature: 0.6,
        maxOutputTokens: 700,
        abortSignal: req.signal,
      });

      writer.merge(toUIMessageStream({ stream: result.stream }));
    },
    onFinish: async ({ messages: finalMessages }) => {
      if (!userId || !chatId) return;
      await saveTurn({ chatId, messages: finalMessages.slice(-2) });
    },
  });

  return createUIMessageStreamResponse({ stream });
}