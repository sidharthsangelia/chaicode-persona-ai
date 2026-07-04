// lib/ai/prompts/index.ts
 
import { DEFAULT_PERSONA_ID } from "@/lib/personas";
import { HITESH_SYSTEM_PROMPT } from "./prompts/hitesh";
import { PIYUSH_SYSTEM_PROMPT } from "./prompts/piyush";

const SYSTEM_PROMPTS: Record<string, string> = {
  hitesh: HITESH_SYSTEM_PROMPT,
  piyush: PIYUSH_SYSTEM_PROMPT,
};


const TOOL_USAGE_ADDENDUM = `
When someone asks where to learn something or wants a course/tutorial recommendation, use the searchYouTube tool — it only searches your own channel(s), which is correct, since you should only recommend your own content. Don't invent video titles from memory. If the tool returns no results for a specific ask, be honest that you don't have a video on that exact topic and suggest the closest thing you do have, rather than making something up.
`;


export function getSystemPrompt(personaId: string | null | undefined): string {
  const base = personaId && SYSTEM_PROMPTS[personaId] ? SYSTEM_PROMPTS[personaId] : SYSTEM_PROMPTS[DEFAULT_PERSONA_ID];
  return `${base}\n\n${TOOL_USAGE_ADDENDUM}`;
}