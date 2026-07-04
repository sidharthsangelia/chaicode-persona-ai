"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
  onSend: (text: string) => void;
  isStreaming: boolean;
  placeholder: string;
}

export function ChatComposer({
  onSend,
  isStreaming,
  placeholder,
}: ChatComposerProps) {
  const [input, setInput] = useState("");

  function submit() {
    const trimmed = input.trim();

    if (!trimmed || isStreaming) return;

    onSend(trimmed);
    setInput("");
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="
          relative
          flex
          items-end
          rounded-[30px]
          border
          bg-background
          px-3
          py-2
          shadow-sm
        "
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={isStreaming}
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
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
            !input.trim() && "opacity-50"
          )}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}