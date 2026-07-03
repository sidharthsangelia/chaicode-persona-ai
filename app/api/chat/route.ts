// app/api/chat/route.ts
import { getSystemPrompt } from "@/lib/ai";
import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, type UIMessage } from "ai";

export async function POST(req: Request) {
  const { messages, personaId }: { messages: UIMessage[]; personaId?: string } =
    await req.json();

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: getSystemPrompt(personaId),
    messages: await convertToModelMessages(messages),
    temperature: 0.6,
    maxOutputTokens: 700,
    abortSignal: req.signal,
  });

  return result.toUIMessageStreamResponse();
}
