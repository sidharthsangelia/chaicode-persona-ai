import { hiteshPersona } from "./hitesh";
import { piyushPersona } from "./piyush";

export interface PersonaDefinition {
  id: "hitesh" | "piyush";
  name: string;
  shortName: string;
  tagline: string;
  avatarInitials: string;
  themeLabel: string;
  systemPrompt: string;
}

export const PERSONAS: Record<string, PersonaDefinition> = {
  hitesh: hiteshPersona,
  piyush: piyushPersona,
};

export const DEFAULT_PERSONA_ID = "hitesh";

export function getPersonaById(id: string | null | undefined): PersonaDefinition {
  if (id && PERSONAS[id]) return PERSONAS[id];
  return PERSONAS[DEFAULT_PERSONA_ID];
}

export function listPersonas(): PersonaDefinition[] {
  return Object.values(PERSONAS);
}
