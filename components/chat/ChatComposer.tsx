"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="
        relative
        rounded-3xl
        border
        bg-background
        p-2
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
          if (
            e.key === "Enter" &&
            !e.shiftKey
          ) {
            e.preventDefault();
            submit();
          }
        }}
        className="
          min-h-[56px]
          max-h-[200px]
          resize-none
          border-0
          bg-transparent
          px-4
          py-3
          text-[15px]
          shadow-none
          focus-visible:ring-0
        "
      />

      <div className="absolute bottom-3 right-3">
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isStreaming}
          className="
            h-9
            w-9
            rounded-full
          "
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}