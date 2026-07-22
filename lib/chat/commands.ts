/**
 * Slash commands for the composer.
 *
 * The assistant is a general mentor by default, so the course index stays shut
 * unless the learner points at it. That is the right default — most technical
 * questions want a fast answer, not a lesson reference — but it leaves no way to
 * say "from now on, answer from the course". This is that way.
 *
 * Data rather than a switch statement so the menu, the parser and the composer
 * all read from one list, and adding a second command is one entry.
 */
export interface SlashCommand {
  /** Bare name, no slash. */
  name: string;
  /** What the menu shows. */
  label: string;
  description: string;
}

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  {
    name: "course",
    label: "/course",
    description: "Answer from the Expo course only, always with citations",
  },
];

/**
 * Commands matching what has been typed so far, for the autocomplete menu.
 *
 * Only matches while the token is still being typed: once there is a space the
 * learner has moved on to the question, and a menu covering the composer would
 * be in the way.
 */
export function matchCommands(input: string): SlashCommand[] {
  if (!input.startsWith("/") || /\s/.test(input)) return [];
  const typed = input.slice(1).toLowerCase();
  return SLASH_COMMANDS.filter((c) => c.name.startsWith(typed));
}

export interface ParsedInput {
  command: SlashCommand | null;
  /** What is left after the command is stripped. */
  rest: string;
}

/**
 * Splits a leading command off the input.
 *
 * Accepts both "/course" alone and "/course how do I read params" — the mode is
 * sticky either way, so there is no reason to make the learner send two
 * messages when they already knew what they wanted to ask.
 */
export function parseCommand(input: string): ParsedInput {
  const match = /^\/([a-z]+)(?:\s+([\s\S]*))?$/i.exec(input.trim());
  if (!match) return { command: null, rest: input };

  const command = SLASH_COMMANDS.find((c) => c.name === match[1].toLowerCase());
  if (!command) return { command: null, rest: input };

  return { command, rest: (match[2] ?? "").trim() };
}
