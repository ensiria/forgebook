/**
 * The tools `forgebook mcp` offers agents, each answered by the catalogue as `forgebook stories` and `forgebook story`
 * are: `list_stories`, `get_story`, `story_address`.
 *
 * @module
 */
import { filteredStories, isStoriesDocument } from "../../src/vite/agentApi.ts";
import type { AgentAnswer } from "../../src/vite/agentRoutes.ts";
import type { McpTool, McpToolResult } from "../../src/vite/mcpProtocol.ts";
import type { NewStoriesFile } from "./newStoriesFile.ts";

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

/** Writes a component's first stories, as `forgebook new --print` does. */
type NewStories = (file: string, exportName: string | undefined) => Promise<NewStoriesFile>;

/**
 * The tools, asking the catalogue through `ask`.
 *
 * @param ask - asks the catalogue (the running dev server, or the server `forgebook mcp` keeps).
 * @param writeNew - writes a component's first stories, the file relative to the catalogue's folder.
 */
export const catalogueTools = (ask: Ask, writeNew: NewStories): readonly McpTool[] => [
  {
    name: "list_stories",
    description:
      "List the catalogue's components and stories, with each story's id and the links that open it, and the problems the story index found. Filter by source id or by text in a component's title.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "Only this source's stories (its id)." },
        component: { type: "string", description: "Only components whose title holds this text, any case." },
        usedIn: {
          type: "boolean",
          description:
            "Add each component's usedIn: the components whose stories use it, directly or through another. Reads the package's import graph, so the first call takes longer."
        },
        view: VIEW
      },
      additionalProperties: false
    },
    call: async (args: Readonly<Record<string, unknown>>): Promise<McpToolResult> => {
      const answer = await ask(
        "stories",
        new URLSearchParams({ view: textOf(args, "view") ?? "", usedIn: String(args["usedIn"] === true) })
      );
      if (answer.status !== 200 || !isStoriesDocument(answer.body)) return resultOf(answer);
      const filter = { source: textOf(args, "source"), component: textOf(args, "component") };
      return { structured: filteredStories(answer.body, filter), isError: false };
    }
  },
  {
    name: "get_story",
    description:
      "One story in detail: its args as the catalogue renders it, its component's props (types, defaults, descriptions), the components whose stories use it (usedIn), its links in the view asked for, and what failed while reading it.",
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
  },
  {
    name: "new_stories",
    description:
      "Write a component's first stories from its typed props (the main story with its required props, one story per value of its first choice prop, the worst case) and answer the file's text and where it would go; writes nothing.",
    inputSchema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          description: "The component's file, relative to the catalogue's folder or absolute."
        },
        export: { type: "string", description: "The component to read, when the file exports several." }
      },
      required: ["file"],
      additionalProperties: false
    },
    call: async (args: Readonly<Record<string, unknown>>): Promise<McpToolResult> => {
      try {
        const written = await writeNew(textOf(args, "file") ?? "", textOf(args, "export"));
        return { structured: { file: written.file, text: written.text }, isError: false };
      } catch (error) {
        return {
          structured: { error: error instanceof Error ? error.message : String(error) },
          isError: true
        };
      }
    }
  }
];
