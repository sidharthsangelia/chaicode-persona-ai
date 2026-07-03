// app/api/chat/route.ts
import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { hiteshPersona } from "@/lib/ai/personas/hitesh";
import { piyushPersona } from "@/lib/ai/personas/piyush";

 
export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: hiteshPersona.systemPrompt,
    messages: await convertToModelMessages(messages),
    temperature: 0.6,
    maxOutputTokens: 700,
    abortSignal: req.signal,
  });

  return result.toUIMessageStreamResponse();
}