// lib/personas.ts
export interface PersonaMeta {
  id: "hitesh" | "piyush";
  name: string;
  shortName: string;
  initials: string;
  tagline: string;
  avatar: string;
}

export const PERSONAS: Record<string, PersonaMeta> = {
  hitesh: {
    id: "hitesh",
    name: "Hitesh Choudhary",
    shortName: "Hitesh",
    initials: "HC",
    tagline: "Chai aur Code",
    avatar: "/hitesh.jpg",
  },
  piyush: {
    id: "piyush",
    name: "Piyush Garg",
    shortName: "Piyush",
    initials: "PG",
    tagline: "piyushgarg.dev",
    avatar: "/piyush.jpg",
  },
};

export const DEFAULT_PERSONA_ID = "hitesh";

export function getPersonaMeta(id: string | null | undefined): PersonaMeta {
  if (id && PERSONAS[id]) return PERSONAS[id];
  return PERSONAS[DEFAULT_PERSONA_ID];
}
