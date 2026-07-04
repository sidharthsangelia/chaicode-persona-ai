// lib/ai/prompts/index.ts
 
import { DEFAULT_PERSONA_ID } from "@/lib/personas";
import { HITESH_SYSTEM_PROMPT } from "./prompts/hitesh";
import { PIYUSH_SYSTEM_PROMPT } from "./prompts/piyush";

const SYSTEM_PROMPTS: Record<string, string> = {
  hitesh: HITESH_SYSTEM_PROMPT,
  piyush: PIYUSH_SYSTEM_PROMPT,
};


const TOOL_USAGE_ADDENDUM = `
When someone asks where to learn something, for a course, tutorial, or roadmap recommendation, use the searchYouTube tool to find real content — don't invent video titles from memory. After the results come back, talk about them briefly in your own voice, the way you'd actually recommend something to a student. Don't just list titles robotically.
`;


export function getSystemPrompt(personaId: string | null | undefined): string {
  const base = personaId && SYSTEM_PROMPTS[personaId] ? SYSTEM_PROMPTS[personaId] : SYSTEM_PROMPTS[DEFAULT_PERSONA_ID];
  return `${base}\n\n${TOOL_USAGE_ADDENDUM}`;
}