import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { PersonaMeta } from "@/lib/personas";
import { PersonaSwitcher } from "./PersonaSwitcher";

interface ChatHeaderProps {
  persona: PersonaMeta;
  personaId: string;
  onPersonaChange: (id: string) => void;
  disabled?: boolean;
}

export function ChatHeader({ persona, personaId, onPersonaChange, disabled }: ChatHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger className="-ml-1" />
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="text-xs font-semibold">{persona.initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold">{persona.name}</p>
          <p className="truncate text-xs text-muted-foreground">{persona.tagline}</p>
        </div>
      </div>
      <PersonaSwitcher value={personaId} onChange={onPersonaChange} disabled={disabled} />
    </header>
  );
}