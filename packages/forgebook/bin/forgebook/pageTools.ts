/**
 * The tools that read a catalogue's docs pages: `list_pages` and `get_page`, each answered as the command of the same
 * name answers.
 *
 * @module
 */
import { isPagesDocument } from "../../src/vite/agentApi.ts";
import type { McpTool, McpToolResult } from "../../src/vite/mcpProtocol.ts";
import { type Ask, resultOf, textOf, VIEW } from "./mcpToolParts.ts";

/**
 * The tools.
 *
 * @param ask - asks the catalogue.
 */
export const pageTools = (ask: Ask): readonly McpTool[] => [
  {
    name: "list_pages",
    description:
      "List the catalogue's docs pages (guides, foundations, recipes) in reading order, each with its id, what it is about, the stories it shows and the address that opens it. Read one with get_page before writing against a guide.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "Only this source's pages (its id)." },
        view: VIEW
      },
      additionalProperties: false
    },
    call: async (args: Readonly<Record<string, unknown>>): Promise<McpToolResult> => {
      const answer = await ask("pages", new URLSearchParams({ view: textOf(args, "view") ?? "" }));
      if (answer.status !== 200 || !isPagesDocument(answer.body)) return resultOf(answer);
      const source = textOf(args, "source");
      const pages = answer.body.pages.filter((page) => source === undefined || page.source === source);
      return { structured: { ...answer.body, pages }, isError: false };
    }
  },
  {
    name: "get_page",
    description:
      "One docs page to read: its Markdown (a ```story <id> fence is a live story, which get_story reads), its headings, and the address that opens it for a person.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The page's id, as list_pages gives it; `home` for the catalogue's written home."
        },
        view: VIEW
      },
      required: ["id"],
      additionalProperties: false
    },
    call: async (args: Readonly<Record<string, unknown>>): Promise<McpToolResult> =>
      resultOf(
        await ask(
          "page",
          new URLSearchParams({ id: textOf(args, "id") ?? "", view: textOf(args, "view") ?? "" })
        )
      )
  }
];
