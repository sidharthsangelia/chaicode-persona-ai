"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface ActiveChatContextValue {
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
}

const ActiveChatContext = createContext<ActiveChatContextValue | null>(null);

export function ActiveChatProvider({ children }: { children: ReactNode }) {
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  return (
    <ActiveChatContext.Provider value={{ activeChatId, setActiveChatId }}>
      {children}
    </ActiveChatContext.Provider>
  );
}

export function useActiveChat() {
  const ctx = useContext(ActiveChatContext);
  if (!ctx) throw new Error("useActiveChat must be used within ActiveChatProvider");
  return ctx;
}