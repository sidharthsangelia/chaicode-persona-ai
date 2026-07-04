"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { PersonaMeta } from "@/lib/personas";
import { getGreeting } from "@/utils/greetings";

const STARTERS: Record<string, string[]> = {
  hitesh: [
    "How should I start learning web development in 2026?",
    "React vs Next.js — what should I learn first?",
    "Should I learn frontend or backend first?",
    "How long does it realistically take to get job ready?",
    "What projects should I build for my resume?",
    "How important is DSA for web developers?",
    "How do I stay consistent while learning to code?",
    "What should my roadmap look like for becoming full stack?",
    "Which backend framework should I learn first?",
    "How much JavaScript do I need before learning React?",
    "How do I prepare for developer interviews?",
    "What mistakes do beginners make while learning coding?",
    "Should I learn TypeScript from the beginning?",
    "How do I avoid tutorial hell?",
    "Can I get a developer job without a degree?",
    "How should I build my portfolio?",
    "How much DevOps should a full stack developer know?",
    "What skills make developers stand out today?",
    "How should I prepare for internships?",
    "How do I become better at problem solving?",
  ],

  piyush: [
    "How should I structure a scalable Node.js backend?",
    "When should I choose SQL over NoSQL?",
    "How should authentication work in a production app?",
    "How should I design multi-tenant applications?",
    "What caching strategy should I use?",
    "How should I approach system design interviews?",
    "How do I design APIs that scale well?",
    "How should I structure large Next.js applications?",
    "How should rate limiting work in production systems?",
    "How should I design an event driven architecture?",
    "When should I use queues and background jobs?",
    "How do I design a notification system?",
    "How do I optimize PostgreSQL queries?",
    "How should I structure a monorepo?",
    "How should I handle file uploads at scale?",
    "How do I approach horizontal scaling?",
    "How should I design microservices communication?",
    "What does observability look like in production?",
    "How should I handle distributed transactions?",
    "How do I prepare for senior backend interviews?",
  ],
};

function shuffle<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

export function ChatEmptyState({
  persona,
  onSuggestionClick,
}: {
  persona: PersonaMeta;
  onSuggestionClick: (text: string) => void;
}) {
  const suggestions = useMemo(() => {
    return shuffle(STARTERS[persona.id] ?? []).slice(0, 4);
  }, [persona.id]);

  const greeting = useMemo(() => getGreeting(persona.id), [persona.id]);
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">{greeting}</h1>

          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
            {persona.tagline}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              variant="outline"
              onClick={() => onSuggestionClick(suggestion)}
              className="
                h-auto
                min-h-[96px]
                justify-start
                rounded-2xl
                px-5
                py-5
                text-left
                whitespace-normal
                text-sm
                font-normal
                leading-6
                transition-all
                duration-200
                hover:scale-[1.01]
              "
            >
              {suggestion}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
