"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { PersonaMeta } from "@/lib/personas";

const STARTERS: Record<string, string[]> = {
  hitesh: [
    "Chai peeke aaya? React seekhna hai kaha se start karu?",
    "Backend ya frontend, pehle kya seekhu?",
    "Naukri milegi ki nahi is field mein?",
  ],
  piyush: [
    "How do I structure a scalable Node.js backend?",
    "Explain the difference between SQL and NoSQL for my project",
    "What should my system design prep look like?",
  ],
};

export function ChatEmptyState({
  persona,
  onSuggestionClick,
}: {
  persona: PersonaMeta;
  onSuggestionClick: (text: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="flex max-w-3xl flex-col items-center text-center">
        <Avatar className="mb-6 h-16 w-16">
          <AvatarImage src={persona.avatar} />
          <AvatarFallback className="text-lg font-semibold">
            {persona.initials}
          </AvatarFallback>
        </Avatar>

        <h1 className="text-3xl font-semibold tracking-tight">
          {persona.name}
        </h1>

        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          {persona.tagline}
        </p>

        <div className="mt-10 grid w-full max-w-2xl gap-3 md:grid-cols-3">
          {(STARTERS[persona.id] ?? []).map((suggestion) => (
            <Button
              key={suggestion}
              variant="outline"
              className="
                h-auto
                min-h-[92px]
                justify-start
                rounded-2xl
                px-5
                py-4
                text-left
                whitespace-normal
                font-normal
              "
              onClick={() => onSuggestionClick(suggestion)}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}