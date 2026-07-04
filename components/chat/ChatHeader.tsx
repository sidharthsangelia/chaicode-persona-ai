"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import type { PersonaMeta } from "@/lib/personas";
import { PersonaSwitcher } from "./PersonaSwitcher";

interface ChatHeaderProps {
  persona: PersonaMeta;
  personaId: string;
  onPersonaChange: (id: string) => void;
  disabled?: boolean;
}

export function ChatHeader({
  persona,
  personaId,
  onPersonaChange,
  disabled,
}: ChatHeaderProps) {
  return (
    <header
      className="
        sticky
        top-0
        z-20
        flex
        items-center
        justify-between
        border-b
        bg-background/95
        px-4
        py-3
        backdrop-blur
        supports-[backdrop-filter]:bg-background/80
      "
    >
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger className="-ml-1 shrink-0" />

        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight">
            Chat with {persona.shortName}
          </h1>

          <p className="truncate text-xs text-muted-foreground">
            {persona.tagline}
          </p>
        </div>
      </div>

      <PersonaSwitcher
        value={personaId}
        onChange={onPersonaChange}
        disabled={disabled}
      />
    </header>
  );
}