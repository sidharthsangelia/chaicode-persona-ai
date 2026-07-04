"use client";

import { useMemo } from "react";
import { Sparkles, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PersonaMeta } from "@/lib/personas";
import { getGreeting } from "@/utils/greetings";
import { STARTERS } from "@/utils/starters";

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