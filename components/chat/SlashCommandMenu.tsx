"use client";

import type { SlashCommand } from "@/lib/chat/commands";
import { cn } from "@/lib/utils";

/**
 * Autocomplete for slash commands, shown above the composer while one is typed.
 *
 * Presentational on purpose: the composer owns the input, the highlighted index
 * and the keyboard handling, because Enter and Arrow keys have to be intercepted
 * before the textarea sees them. This just draws the list.
 */
export function SlashCommandMenu({
  commands,
  activeIndex,
  onSelect,
}: {
  commands: SlashCommand[];
  activeIndex: number;
  onSelect: (command: SlashCommand) => void;
}) {
  if (commands.length === 0) return null;

  return (
    <div
      // Not a listbox role: focus stays in the textarea the whole time, so the
      // composer wires this up with aria-activedescendant instead.
      id="slash-command-menu"
      className="
        absolute
        bottom-full
        left-0
        z-20
        mb-2
        w-full
        overflow-hidden
        rounded-2xl
        border
        bg-popover
        shadow-md
        animate-in
        fade-in
        slide-in-from-bottom-1
        duration-150
      "
    >
      {commands.map((command, i) => (
        <button
          key={command.name}
          id={`slash-command-${command.name}`}
          type="button"
          // onMouseDown, not onClick: click fires after blur, which would close
          // the menu before the selection lands.
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(command);
          }}
          className={cn(
            `
              flex
              w-full
              items-baseline
              gap-3
              px-4
              py-2.5
              text-left
              transition-colors
            `,
            i === activeIndex ? "bg-muted" : "hover:bg-muted/50",
          )}
        >
          <span className="font-mono text-sm font-medium">{command.label}</span>
          <span className="truncate text-xs text-muted-foreground">
            {command.description}
          </span>
        </button>
      ))}
    </div>
  );
}
