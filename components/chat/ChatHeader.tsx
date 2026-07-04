"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import type { PersonaMeta } from "@/lib/personas";
import { PersonaSwitcher } from "./PersonaSwitcher";

interface ChatHeaderProps {
  persona: PersonaMeta;
  personaId: string;
  onPersonaChange: (id: string) => void;
  startsNewChatOnSwitch?: boolean;
}

export function ChatHeader({
  persona,
  personaId,
  onPersonaChange,
  startsNewChatOnSwitch = false,
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
        gap-4
        border-b
        bg-background/95
        px-4
        py-3
        backdrop-blur-xl
        supports-[backdrop-filter]:bg-background/80
      "
    >
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger
          className="
            -ml-1
            shrink-0
            rounded-lg
          "
        />

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold tracking-tight">
              Chat with {persona.shortName}
            </h1>

            <span
              className="
                hidden
                rounded-full
                border
                px-2
                py-0.5
                text-[10px]
                font-medium
                text-muted-foreground
                sm:inline-flex
              "
            >
              Mentor
            </span>
          </div>

          <p className="truncate text-xs text-muted-foreground">
            {persona.tagline}
          </p>
        </div>
      </div>

      <div className="shrink-0">
        <PersonaSwitcher
          value={personaId}
          onChange={onPersonaChange}
          startsNewChatOnSwitch={startsNewChatOnSwitch}
        />
      </div>
    </header>
  );
}