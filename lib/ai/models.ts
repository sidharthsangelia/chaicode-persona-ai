/**
 * Central place defining which model string is used for chat completions.
 * Swap the MODEL constant to change models everywhere without touching route logic.
 */
export const CHAT_MODEL = process.env.CHAT_MODEL ?? "gpt-4o-mini";
