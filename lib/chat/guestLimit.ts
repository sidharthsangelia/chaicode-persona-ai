export const GUEST_MESSAGE_LIMIT = 5;

export function countUserMessages(messages: { role: string }[]) {
  return messages.filter((m) => m.role === "user").length;
}