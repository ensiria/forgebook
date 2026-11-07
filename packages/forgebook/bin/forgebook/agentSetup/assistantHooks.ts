/**
 * The assistants whose hook format `forgebook init --agents` writes, and what it writes for each: a hook that runs
 * `forgebook hook <assistant>` when the assistant is about to finish.
 *
 * @remarks
 * Only formats read in each assistant's own documentation are here; another assistant gets the pre-commit hook or the
 * instructions. All four read JSON, so a file the project already has is merged, and one that cannot be parsed is left
 * as it is and named. Cursor's `stop` hook cannot refuse to finish: it starts another turn with a message, so what it
 * does is said separately (`effect`). Pure: text in, text out.
 *
 * @see https://code.claude.com/docs/en/hooks
 * @see https://developers.openai.com/codex/hooks
 * @see https://cursor.com/docs/agent/hooks
 * @see https://geminicli.com/docs/hooks/reference/
 * @module
 */

/** An assistant with a hook format. */
export type AssistantName = "claude" | "codex" | "cursor" | "gemini";

/** What a person reads about an assistant's hook, and where it goes. */
export type Assistant = {
  /** Its name, for a person. */
  readonly label: string;
  /** The file holding its project hooks, from the repository's root. */
  readonly file: string;
  /** What in a repository says it is used. */
  readonly markers: readonly string[];
  /** What the hook can do: refuse to finish, or start another turn. */
  readonly effect: "blocks" | "continues";
  /** What the assistant asks before the hook runs; none when it runs at once. */
  readonly caveat: string | undefined;
};

/** The assistants, by the name `forgebook hook` takes. */
export const ASSISTANTS: Readonly<Record<AssistantName, Assistant>> = {
  claude: {
    label: "Claude Code",
    file: ".claude/settings.json",
    markers: [".claude", "CLAUDE.md"],
    effect: "blocks",
    caveat: undefined
  },
  codex: {
    label: "Codex",
    file: ".codex/hooks.json",
    markers: [".codex"],
    effect: "blocks",
    caveat: "Codex runs a project's hooks once they are reviewed and trusted"
  },
  cursor: {
    label: "Cursor",
    file: ".cursor/hooks.json",
    markers: [".cursor", ".cursorrules"],
    effect: "continues",
    caveat: undefined
  },
  gemini: {
    label: "Gemini CLI",
    file: ".gemini/settings.json",
    markers: [".gemini", "GEMINI.md"],
    effect: "blocks",
    caveat: undefined
  }
};

/** The names, in the order they are listed. */
export const ASSISTANT_NAMES: readonly AssistantName[] = ["claude", "codex", "cursor", "gemini"];

/** How long a hook may run, in seconds: a first start pre-bundles, and every view of every story runs. */
const HOOK_SECONDS = 600;

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a list of an event's entries already holds this very command: another package's catalogue has its own. */
const holdsOwnHook = (entries: readonly unknown[], command: string): boolean =>
  JSON.stringify(entries).includes(JSON.stringify(command));

/** What an assistant's file holds for one event: its name and the entry to add. */
const eventEntry = (assistant: AssistantName, command: string): { event: string; entry: unknown } => {
  const hook = { type: "command", command };
  if (assistant === "cursor")
    return { event: "stop", entry: { command, timeout: HOOK_SECONDS, loop_limit: 5 } };
  if (assistant === "gemini")
    return {
      event: "AfterAgent",
      entry: { hooks: [{ ...hook, name: "forgebook-verify", timeout: HOOK_SECONDS * 1000 }] }
    };
  return { event: "Stop", entry: { hooks: [{ ...hook, timeout: HOOK_SECONDS }] } };
};

/** What came of merging a file. */
export type MergedFile =
  | {
      /** The file's new text. */
      readonly kind: "written";
      /** Its text. */
      readonly text: string;
    }
  | {
      /** It already holds it. */
      readonly kind: "unchanged";
    }
  | {
      /** It cannot be parsed, or its shape is not the documented one: left as it is. */
      readonly kind: "unreadable";
    };

/** The text of a parsed JSON file, or why it stays as it is: a file's top level must be an object. */
const parsedObject = (text: string | undefined): Readonly<Record<string, unknown>> | undefined => {
  if (text === undefined || text.trim() === "") return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

/**
 * An assistant's hooks file with Forgebook's hook in it: everything else stays as it was.
 *
 * @param assistant - the assistant.
 * @param text - the file's text; none when there is no file.
 * @param command - the command the hook runs.
 */
export const withStopHook = (
  assistant: AssistantName,
  text: string | undefined,
  command: string
): MergedFile => {
  const file = parsedObject(text);
  if (file === undefined) return { kind: "unreadable" };
  const hooks = file["hooks"] ?? {};
  if (!isRecord(hooks)) return { kind: "unreadable" };
  const { event, entry } = eventEntry(assistant, command);
  const entries = hooks[event] ?? [];
  if (!Array.isArray(entries)) return { kind: "unreadable" };
  if (holdsOwnHook(entries, command)) return { kind: "unchanged" };
  const merged = {
    ...(assistant === "cursor" ? { version: 1 } : {}),
    ...file,
    hooks: { ...hooks, [event]: [...entries, entry] }
  };
  return { kind: "written", text: `${JSON.stringify(merged, null, 2)}\n` };
};

/** The command of an MCP server, as a client starts it. */
export type McpServer = {
  /** The program. */
  readonly command: string;
  /** Its arguments. */
  readonly args: readonly string[];
};

/**
 * A `.mcp.json` with Forgebook's server in it: the other servers stay, and a server already named `forgebook` is the
 * project's own choice, so it stays as well.
 *
 * @param text - the file's text; none when there is no file.
 * @param server - how the client starts Forgebook's server.
 */
export const withMcpServer = (text: string | undefined, server: McpServer): MergedFile => {
  const file = parsedObject(text);
  if (file === undefined) return { kind: "unreadable" };
  const servers = file["mcpServers"] ?? {};
  if (!isRecord(servers)) return { kind: "unreadable" };
  if ("forgebook" in servers) return { kind: "unchanged" };
  const merged = { ...file, mcpServers: { ...servers, forgebook: server } };
  return { kind: "written", text: `${JSON.stringify(merged, null, 2)}\n` };
};
