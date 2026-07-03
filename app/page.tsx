"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat();
  const isStreaming = status === "streaming" || status === "submitted";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    sendMessage({ text: input });
    setInput("");
  }

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col">
      <header className="border-b px-4 py-3">
        <h1 className="text-sm font-medium">Chat with Hitesh</h1>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
        {messages.map((message) => (
          <div
            key={message.id}
            className={message.role === "user" ? "text-right" : "text-left"}
          >
            <div
              className={
                "inline-block max-w-[80%] rounded-2xl px-4 py-2 text-sm " +
                (message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted")
              }
            >
              {message.parts.map((part, i) =>
                part.type === "text" ? <span key={i}>{part.text}</span> : null
              )}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="border-t p-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Hitesh…"
          className="w-full rounded-md border px-3 py-2 text-sm"
          disabled={isStreaming}
        />
      </form>
    </div>
  );
}