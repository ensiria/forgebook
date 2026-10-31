/**
 * The tools `forgebook mcp` offers agents, each answered by the catalogue as `forgebook stories` and `forgebook story`
 * are: `list_stories`, `get_story`, `story_address`.
 *
 * @module
 */
import { filteredStories, isStoriesDocument } from "../../src/vite/agentApi.ts";
import type { AgentAnswer } from "../../src/vite/agentRoutes.ts";
import type { McpTool, McpToolResult } from "../../src/vite/mcpProtocol.ts";

/** Asks the catalogue one of its answers. */
type Ask = (route: string, params: URLSearchParams) => Promise<AgentAnswer>;

/** The schema of the view argument, shared by the tools. */
const VIEW = {
  type: "string",
  description:
    "The view the links open in, as the catalogue's address writes it (theme=dark&lang=it); none for the default."
} as const;

/** A text argument, or none. */
const textOf = (args: Readonly<Record<string, unknown>>, name: string): string | undefined => {
  const value = args[name];
  return typeof value === "string" && value !== "" ? value : undefined;
};

/** An answer as a tool's result: a failure when the catalogue did not answer 200. */
const resultOf = (answer: AgentAnswer): McpToolResult => ({
  structured: answer.body,
  isError: answer.status !== 200
});

/**
 * The tools, asking the catalogue through `ask`.
 *
 * @param ask - asks the catalogue (the running dev server, or the server `forgebook mcp` keeps).
 */
export const catalogueTools = (ask: Ask): readonly McpTool[] => [
  {
    name: "list_stories",
    description:
      "List the catalogue's components and stories, with each story's id and the links that open it, and the problems the story index found. Filter by source id or by text in a component's title.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "Only this source's stories (its id)." },
        component: { type: "string", description: "Only components whose title holds this text, any case." },
        view: VIEW
      },
      additionalProperties: false
    },
    call: async (args: Readonly<Record<string, unknown>>): Promise<McpToolResult> => {
      const answer = await ask("stories", new URLSearchParams({ view: textOf(args, "view") ?? "" }));
      if (answer.status !== 200 || !isStoriesDocument(answer.body)) return resultOf(answer);
      const filter = { source: textOf(args, "source"), component: textOf(args, "component") };
      return { structured: filteredStories(answer.body, filter), isError: false };
    }
  },
  {
    name: "get_story",
    description:
      "One story in detail: its args as the catalogue renders it, its component's props (types, defaults, descriptions), its links in the view asked for, and what failed while reading it.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The story's id, as list_stories gives it." },
        view: VIEW
      },
      required: ["id"],
      additionalProperties: false
    },
    call: async (args: Readonly<Record<string, unknown>>): Promise<McpToolResult> =>
      resultOf(
        await ask(
          "story",
          new URLSearchParams({ id: textOf(args, "id") ?? "", view: textOf(args, "view") ?? "" })
        )
      )
  },
  {
    name: "story_address",
    description:
      "The links that open a story in the catalogue and in its frame alone, in the view asked for: give them to a person to look at what you describe.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The story's id, as list_stories gives it." },
        view: VIEW
      },
      required: ["id"],
      additionalProperties: false
    },
    call: async (args: Readonly<Record<string, unknown>>): Promise<McpToolResult> => {
      const id = textOf(args, "id") ?? "";
      const answer = await ask("stories", new URLSearchParams({ view: textOf(args, "view") ?? "" }));
      if (answer.status !== 200 || !isStoriesDocument(answer.body)) return resultOf(answer);
      const story = answer.body.components
        .flatMap((component) => component.stories)
        .find((each) => each.id === id);
      return story === undefined
        ? { structured: { error: `No story "${id}"` }, isError: true }
        : { structured: { id, links: story.links }, isError: false };
    }
  }
];
