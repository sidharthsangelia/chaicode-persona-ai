"use client";

import { ArrowUp, BookOpen, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  matchCommands,
  parseCommand,
  type SlashCommand,
} from "@/lib/chat/commands";
import { cn } from "@/lib/utils";
import { SlashCommandMenu } from "./SlashCommandMenu";

interface ChatComposerProps {
  /**
   * `courseModeOverride` exists for "/course <question>", which turns the mode
   * on and sends in the same tick. React has not re-rendered the parent at that
   * point, so its `courseMode` is still false and the request would go out
   * ungrounded — the mode has to travel with the message, not be read from state.
   */
  onSend: (text: string, courseModeOverride?: boolean) => void;
  isStreaming: boolean;
  placeholder: string;
  /** Course mode is sticky, so it lives in the chat, not in this component. */
  courseMode: boolean;
  onCourseModeChange: (on: boolean) => void;
}

export function ChatComposer({
  onSend,
  isStreaming,
  placeholder,
  courseMode,
  onCourseModeChange,
}: ChatComposerProps) {
  const [input, setInput] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  // Escape hides the menu without clearing what was typed, so it has to be
  // remembered separately from whether the text still matches a command.
  const [dismissed, setDismissed] = useState(false);

  const matches = dismissed ? [] : matchCommands(input);
  const menuOpen = matches.length > 0;

  // Keep the highlight in range as the list filters down.
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, matches.length - 1)));
  }, [matches.length]);

  function applyCommand(command: SlashCommand, rest = "") {
    if (command.name === "course") onCourseModeChange(true);
    setInput(rest);
    setDismissed(false);
  }

  function submit() {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    // "/course" alone turns the mode on and sends nothing; "/course <question>"
    // turns it on and asks in the same breath.
    const { command, rest } = parseCommand(trimmed);
    if (command) {
      applyCommand(command, "");
      if (rest) onSend(rest, command.name === "course");
      return;
    }

    onSend(trimmed);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (menuOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((i) => (i + step + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        applyCommand(matches[activeIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDismissed(true);
        return;
      }
    }

    // Backspace on an empty composer peels the mode chip off, the way it works
    // for attachment chips elsewhere.
    if (e.key === "Backspace" && input === "" && courseMode) {
      e.preventDefault();
      onCourseModeChange(false);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="relative"
      >
        <SlashCommandMenu
          commands={matches}
          activeIndex={activeIndex}
          onSelect={(command) => applyCommand(command)}
        />

        <div
          className="
            flex
            flex-col
            gap-2
            rounded-[30px]
            border
            bg-background
            px-3
            py-2
            shadow-sm
          "
        >
          {courseMode && (
            <div className="flex px-2 pt-1">
              <span
                className="
                  inline-flex
                  items-center
                  gap-1.5
                  rounded-full
                  border
                  bg-muted/60
                  py-1
                  pl-2.5
                  pr-1.5
                  text-xs
                  font-medium
                  animate-in
                  fade-in
                  zoom-in-95
                  duration-200
                "
              >
                <BookOpen className="h-3 w-3" aria-hidden />
                Course mode
                <button
                  type="button"
                  onClick={() => onCourseModeChange(false)}
                  aria-label="Turn off course mode"
                  className="
                    rounded-full
                    p-0.5
                    text-muted-foreground
                    transition-colors
                    hover:bg-background
                    hover:text-foreground
                  "
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            </div>
          )}

          <div className="flex items-end">
            <Textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Typing a fresh "/" should bring the menu back after Escape.
                if (!e.target.value.startsWith("/")) setDismissed(false);
              }}
              placeholder={courseMode ? "Ask about the course..." : placeholder}
              disabled={isStreaming}
              rows={1}
              onKeyDown={handleKeyDown}
              aria-autocomplete="list"
              aria-controls={menuOpen ? "slash-command-menu" : undefined}
              aria-activedescendant={
                menuOpen
                  ? `slash-command-${matches[activeIndex]?.name}`
                  : undefined
              }
              className="
                min-h-[24px]
                max-h-[220px]
                flex-1
                resize-none
                border-0
                bg-transparent
                px-3
                py-2.5
                text-[15px]
                shadow-none
                focus-visible:ring-0
              "
            />

            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isStreaming}
              className={cn(
                `
                ml-2
                h-9
                w-9
                shrink-0
                rounded-full
                transition-all
              `,
                !input.trim() && "opacity-50",
              )}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </form>

      {!courseMode && (
        <p className="mt-2 px-4 text-center text-[11px] text-muted-foreground/70">
          Type <span className="font-mono">/course</span> to ask about the Expo
          course and get exact lesson timestamps
        </p>
      )}
    </div>
  );
}
