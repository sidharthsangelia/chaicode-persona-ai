"use client";

import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PersonaMeta } from "@/lib/personas";
import { getGreeting, getStableGreeting } from "@/utils/greetings";
import { COURSE_STARTERS, STARTERS } from "@/utils/starters";

function shuffle<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

/**
 * Two course questions and two persona questions, always.
 *
 * Drawing all four from one pool would sometimes show four career questions and
 * hide the course entirely — and the course is the one thing this screen has to
 * communicate, since nobody guesses that a chat box knows where dynamic routes
 * are taught.
 */
function pickSuggestions(personaId: string, random: boolean): string[] {
  const course = random ? shuffle(COURSE_STARTERS) : COURSE_STARTERS;
  const persona = STARTERS[personaId] ?? [];
  const mixed = [
    ...course.slice(0, 2),
    ...(random ? shuffle(persona) : persona).slice(0, 2),
  ];
  return random ? shuffle(mixed) : mixed;
}

export function ChatEmptyState({
  persona,
  onSuggestionClick,
}: {
  persona: PersonaMeta;
  onSuggestionClick: (text: string) => void;
}) {
  // The first paint is deterministic so it matches what the server sent; the
  // random greeting and shuffled starters swap in on mount. Randomising during
  // render would make the server and client disagree, and React responds to a
  // hydration mismatch by discarding the server HTML for this whole subtree.
  const [content, setContent] = useState(() => ({
    greeting: getStableGreeting(persona.id),
    suggestions: pickSuggestions(persona.id, false),
  }));

  useEffect(() => {
    setContent({
      greeting: getGreeting(persona.id),
      suggestions: pickSuggestions(persona.id, true),
    });
  }, [persona.id]);

  const { greeting, suggestions } = content;

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="mx-auto w-full max-w-4xl ">
        <div
          className="
            mb-10 flex flex-col items-center text-center
            motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1
            motion-safe:duration-500
          "
        >
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {greeting}
          </h1>

          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Ask me anything about the Expo &amp; React Native course and
            I&apos;ll explain it, then point you to the exact lesson and
            timestamp.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {suggestions.map((suggestion, i) => (
            <Button
              key={suggestion}
              variant="outline"
              onClick={() => onSuggestionClick(suggestion)}
              style={{ animationDelay: `${i * 60}ms` }}
              className="
                group
                h-auto
                min-h-[64px]
                items-start
                justify-between
                gap-3
                rounded-2xl
                border-border/60
                px-4
                py-3.5
                text-left
                whitespace-normal
                text-sm
                font-normal
                leading-snug
                text-foreground/90
                shadow-none
                transition-colors
                duration-150
                hover:border-border
                hover:bg-muted/50
                motion-safe:animate-in
                motion-safe:fade-in
                motion-safe:slide-in-from-bottom-1
                motion-safe:fill-mode-backwards
                motion-safe:duration-500
              "
            >
              <span>{suggestion}</span>
              <ArrowUpRight
                className="
                  mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50
                  transition-all
                  duration-150
                  group-hover:translate-x-0.5
                  group-hover:-translate-y-0.5
                  group-hover:text-muted-foreground
                "
                strokeWidth={1.75}
              />
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
