/**
 * The MCP tools for the design tokens: `list_tokens`, `get_token` and `nearest_token`, answered as the commands of the same
 * name answer.
 *
 * @module
 */
import type { McpTool, McpToolResult } from "../../src/vite/mcpProtocol.ts";
import { type Ask, resultOf, textOf } from "./mcpToolParts.ts";

/**
 * The tools.
 *
 * @param ask - asks the catalogue.
 */
export const tokenTools = (ask: Ask): readonly McpTool[] => [
  {
    name: "list_tokens",
    description:
      "The design tokens of this catalogue and of the libraries it shows or, with no tokens file, what the application declares (CSS variables, Tailwind, components.json), to use instead of a colour, size or duration written by hand: how many of each type, the first of them, `sources` (what was read), `notes` (what was not) and `clashes` where two files disagree. To replace a raw value, call nearest_token; for one token's description, get_token.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "A token type (color) or a first group (space); none for all."
        },
        limit: { type: "number", description: "The most tokens to give; 100 by default." }
      },
      additionalProperties: false
    },
    call: async (args: Readonly<Record<string, unknown>>): Promise<McpToolResult> =>
      resultOf(
        await ask(
          "tokens",
          new URLSearchParams({
            category: textOf(args, "category") ?? "",
            limit: String(args["limit"] ?? "")
          })
        )
      )
  },
  {
    name: "get_token",
    description:
      "One design token: its value in each theme, what it is for, the token it aliases, and why not to use it if deprecated.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", description: "The token's name, as list_tokens gives it." } },
      required: ["name"],
      additionalProperties: false
    },
    call: async (args: Readonly<Record<string, unknown>>): Promise<McpToolResult> =>
      resultOf(await ask("token", new URLSearchParams({ name: textOf(args, "name") ?? "" })))
  },
  {
    name: "nearest_token",
    description:
      "The tokens nearest a value written by hand, nearest first: call it before writing a raw colour or size. Use a match only when `isClose` or `isExact` is true; otherwise no token fits, so say so rather than force one. Deprecated tokens are left out.",
    inputSchema: {
      type: "object",
      properties: {
        value: {
          type: "string",
          description: "The value, as code writes it: #1c1b1b, rgb(1 2 3), 16px, 200ms."
        },
        type: {
          type: "string",
          description:
            "What to compare with: color, dimension, duration, number, fontWeight, or a CSS property (background, padding, font-size). Read from the value when left out."
        }
      },
      required: ["value"],
      additionalProperties: false
    },
    call: async (args: Readonly<Record<string, unknown>>): Promise<McpToolResult> =>
      resultOf(
        await ask(
          "nearest-token",
          new URLSearchParams({ value: textOf(args, "value") ?? "", type: textOf(args, "type") ?? "" })
        )
      )
  }
];
