// lib/personas.ts
export interface PersonaMeta {
  id: "hitesh" | "piyush";
  name: string;
  shortName: string;
  initials: string;
  tagline: string;
}

export const PERSONAS: Record<string, PersonaMeta> = {
  hitesh: {
    id: "hitesh",
    name: "Hitesh Choudhary",
    shortName: "Hitesh",
    initials: "HC",
    tagline: "Chai aur Code",
  },
  piyush: {
    id: "piyush",
    name: "Piyush Garg",
    shortName: "Piyush",
    initials: "PG",
    tagline: "piyushgarg.dev",
  },
};

export const DEFAULT_PERSONA_ID = "hitesh";

export function getPersonaMeta(id: string | null | undefined): PersonaMeta {
  if (id && PERSONAS[id]) return PERSONAS[id];
  return PERSONAS[DEFAULT_PERSONA_ID];
}