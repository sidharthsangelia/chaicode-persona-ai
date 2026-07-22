import { DEFAULT_PERSONA_ID } from "@/lib/personas";
import { HITESH_SYSTEM_PROMPT } from "./prompts/hitesh";
import { PIYUSH_SYSTEM_PROMPT } from "./prompts/piyush";

const SYSTEM_PROMPTS: Record<string, string> = {
  hitesh: HITESH_SYSTEM_PROMPT,
  piyush: PIYUSH_SYSTEM_PROMPT,
};

/**
 * The persona's voice, and nothing else.
 *
 * Task-specific instructions used to be appended here, which meant every request
 * carried every addendum regardless of what it was doing. They now live in
 * lib/ai/answer.ts and are attached per route, so a refusal doesn't ship a
 * YouTube tool briefing and a course question doesn't ship rules for a tool it
 * was never given.
 */
export function getSystemPrompt(personaId: string | null | undefined): string {
  return personaId && SYSTEM_PROMPTS[personaId]
    ? SYSTEM_PROMPTS[personaId]
    : SYSTEM_PROMPTS[DEFAULT_PERSONA_ID];
}
