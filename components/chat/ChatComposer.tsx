"use client";

import { useState } from "react";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";

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
    <PromptInput onSubmit={handleSubmit} className="mx-auto w-full max-w-2xl">
      <PromptInputTextarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        disabled={isStreaming}
      />
      <PromptInputToolbar>
        <PromptInputSubmit status={isStreaming ? "streaming" : "ready"} disabled={!input.trim()} />
      </PromptInputToolbar>
    </PromptInput>
  );
}