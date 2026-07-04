"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { PERSONAS } from "@/lib/personas";
import { cn } from "@/lib/utils";
import { CheckIcon, ChevronsUpDownIcon, Sparkles } from "lucide-react";

interface PersonaSwitcherProps {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  startsNewChatOnSwitch?: boolean;
}

export function PersonaSwitcher({
  value,
  onChange,
  disabled,
  startsNewChatOnSwitch = false,
}: PersonaSwitcherProps) {
  const activePersona = PERSONAS[value];

  return (
    <TooltipProvider delayDuration={300}>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                disabled={disabled}
                className="
                  group
                  flex
                  h-12
                  w-[240px]
                  items-center
                  gap-3
                  rounded-2xl
                  border
                  bg-background
                  px-3
                  transition-all
                  duration-200
                  hover:bg-accent/40
                  active:scale-[0.98]
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={activePersona.avatar} />
                  <AvatarFallback>{activePersona.initials}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium">
                      {activePersona.name}
                    </p>
                  </div>

                  <p className="truncate text-xs text-muted-foreground">
                    {activePersona.tagline}
                  </p>
                </div>

                <ChevronsUpDownIcon
                  className="
                    h-4
                    w-4
                    shrink-0
                    opacity-60
                    transition-transform
                    duration-200
                    group-data-[state=open]:rotate-180
                  "
                />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>

          {startsNewChatOnSwitch && (
            <TooltipContent side="bottom">
              Switching mentors starts a new conversation.
            </TooltipContent>
          )}
        </Tooltip>

        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="
            w-[290px]
            rounded-2xl
            p-2
          "
        >
          {Object.values(PERSONAS).map((persona) => {
            const isSelected = value === persona.id;

            return (
              <DropdownMenuItem
                key={persona.id}
                onClick={() => onChange(persona.id)}
                className="
                  flex
                  items-center
                  gap-3
                  rounded-xl
                  p-3
                  cursor-pointer
                "
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={persona.avatar} />
                  <AvatarFallback>{persona.initials}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {persona.name}
                    </span>

                    {isSelected && (
                      <span className="text-[11px] text-muted-foreground">
                        Active
                      </span>
                    )}
                  </div>

                  <p className="truncate text-xs text-muted-foreground">
                    {persona.tagline}
                  </p>

                  {startsNewChatOnSwitch && !isSelected && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Starts a new conversation
                    </p>
                  )}
                </div>

                <CheckIcon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-opacity",
                    isSelected ? "opacity-100" : "opacity-0",
                  )}
                />
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
