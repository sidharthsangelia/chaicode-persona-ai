"use client";

import type { UIMessage } from "ai";

const KEY = "afterclass:guest-chat";

interface GuestDraft {
  pendingChatId: string;
  personaId: string;
  messages: UIMessage[];
}

export function saveGuestDraft(draft: GuestDraft) {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Private browsing / quota errors — worst case the safety net just isn't there.
  }
}

export function loadGuestDraft(): GuestDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearGuestDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}