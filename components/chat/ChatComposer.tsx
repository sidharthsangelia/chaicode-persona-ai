"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatComposerProps {
  onSend: (text: string) => void;
  isStreaming: boolean;
  placeholder: string;
}

export function ChatComposer({ onSend, isStreaming, placeholder }: ChatComposerProps) {
  const [input, setInput] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSend(input);
    setInput("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        disabled={isStreaming}
        className="h-11 rounded-xl border-muted-foreground/20 px-4 shadow-none focus-visible:ring-1"
      />
      <Button
        type="submit"
        size="icon"
        disabled={!input.trim() || isStreaming}
        className="h-11 w-11 shrink-0 rounded-xl"
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
    </form>
  );
}