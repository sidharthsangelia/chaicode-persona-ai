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
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <Avatar className="h-14 w-14">
        <AvatarImage src={persona.avatar} />
        <AvatarFallback className="text-base font-semibold">{persona.initials}</AvatarFallback>
      </Avatar>
      <div>
        <p className="text-lg font-semibold">{persona.name}</p>
        <p className="text-sm text-muted-foreground">{persona.tagline}</p>
      </div>
      <div className="flex max-w-lg flex-wrap justify-center gap-2">
        {(STARTERS[persona.id] ?? []).map((s) => (
          <Button
            key={s}
            variant="outline"
            size="sm"
            className="h-auto rounded-full whitespace-normal px-3 py-1.5 text-xs"
            onClick={() => onSuggestionClick(s)}
          >
            {s}
          </Button>
        ))}
      </div>
    </div>
  );
}