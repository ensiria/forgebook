/**
 * What the tools `forgebook mcp` offers share: how they ask the catalogue, their view argument and how an answer
 * becomes a result.
 *
 * @module
 */
import type { AgentAnswer } from "../../src/vite/agentRoutes.ts";
import type { McpToolResult } from "../../src/vite/mcpProtocol.ts";

/** Asks the catalogue one of its answers. */
export type Ask = (route: string, params: URLSearchParams) => Promise<AgentAnswer>;

/** The schema of the view argument, shared by the tools. */
export const VIEW = {
  type: "string",
  description:
    "The view the links open in, as the catalogue's address writes it (theme=dark&lang=it, audience=designer); none for the default."
} as const;

/**
 * A text argument, or none.
 *
 * @param args - the tool's arguments.
 * @param name - the argument's name.
 */
export const textOf = (args: Readonly<Record<string, unknown>>, name: string): string | undefined => {
  const value = args[name];
  return typeof value === "string" && value !== "" ? value : undefined;
};

/**
 * An answer as a tool's result: a failure when the catalogue did not answer 200.
 *
 * @param answer - the catalogue's answer.
 */
export const resultOf = (answer: AgentAnswer): McpToolResult => ({
  structured: answer.body,
  isError: answer.status !== 200
});
