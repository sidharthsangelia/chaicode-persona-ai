"use client";

 

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

import { PERSONAS } from "@/lib/personas";
import { cn } from "@/lib/utils";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";

interface PersonaSwitcherProps {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

export function PersonaSwitcher({
  value,
  onChange,
  disabled,
}: PersonaSwitcherProps) {
  const activePersona = PERSONAS[value];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          className="
            flex
            h-12
            w-[220px]
            items-center
            gap-3
            rounded-xl
            border
            bg-background
            px-3
            transition-all
            hover:bg-accent/50
            disabled:opacity-50
          "
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={activePersona.avatar} />
            <AvatarFallback>
              {activePersona.initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-medium">
              {activePersona.name}
            </p>

            <p className="truncate text-xs text-muted-foreground">
              {activePersona.tagline}
            </p>
          </div>

          <ChevronsUpDownIcon className="h-4 w-4 opacity-60" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="
          w-[260px]
          rounded-xl
          p-1
        "
      >
        {Object.values(PERSONAS).map((persona) => (
          <DropdownMenuItem
            key={persona.id}
            onClick={() => onChange(persona.id)}
            className="
              flex
              items-center
              gap-3
              rounded-lg
              p-3
            "
          >
            <Avatar className="h-9 w-9">
              <AvatarImage src={persona.avatar} />
              <AvatarFallback>
                {persona.initials}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {persona.name}
              </div>

              <div className="truncate text-xs text-muted-foreground">
                {persona.tagline}
              </div>
            </div>

            <CheckIcon
              className={cn(
                "h-4 w-4 transition-opacity",
                value === persona.id
                  ? "opacity-100"
                  : "opacity-0"
              )}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}