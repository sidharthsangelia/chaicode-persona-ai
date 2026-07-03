// lib/ai/prompts/index.ts
 
import { DEFAULT_PERSONA_ID } from "@/lib/personas";
import { HITESH_SYSTEM_PROMPT } from "./prompts/hitesh";
import { PIYUSH_SYSTEM_PROMPT } from "./prompts/piyush";

const SYSTEM_PROMPTS: Record<string, string> = {
  hitesh: HITESH_SYSTEM_PROMPT,
  piyush: PIYUSH_SYSTEM_PROMPT,
};

export function getSystemPrompt(personaId: string | null | undefined): string {
  if (personaId && SYSTEM_PROMPTS[personaId]) return SYSTEM_PROMPTS[personaId];
  return SYSTEM_PROMPTS[DEFAULT_PERSONA_ID];
}