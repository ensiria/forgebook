/**
 * The tools `forgebook mcp` offers agents, each answered as the command of the same name answers: `list_stories`,
 * `get_story`, `story_address`, `new_stories`, `check_story`, `recent_errors` and `story_shot`.
 *
 * @module
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { StoryCheckReport, StoryShotReport } from "../../src/storyCheck.ts";
import { filteredStories, isStoriesDocument } from "../../src/vite/agentApi.ts";
import type { AgentAnswer } from "../../src/vite/agentRoutes.ts";
import type { McpTool, McpToolResult } from "../../src/vite/mcpProtocol.ts";
import { askErrors } from "./errorsRun.ts";
import type { NewStoriesFile } from "./newStoriesFile.ts";
import type { StoryCheckInput } from "./storyCheckRun.ts";

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

/** Runs the catalogue's checks on a story in a browser: the report, or why it could not run. */
type Check = (input: StoryCheckInput) => Promise<StoryCheckReport | string>;

/** Takes a story's pictures into a folder: the report, or why they could not be taken. */
type Shot = (input: StoryCheckInput, outDir: string) => Promise<StoryShotReport | string>;

/** What the tools reach the catalogue through. */
export type CatalogueReach = {
  /** Asks the catalogue (the running dev server, or the server `forgebook mcp` keeps). */
  readonly ask: Ask;
  /** Writes a component's first stories, the file relative to the catalogue's folder. */
  readonly writeNew: NewStories;
  /** Runs the checks on a story. */
  readonly check: Check;
  /** Takes a story's pictures. */
  readonly shot: Shot;
};

/**
 * The tools.
 *
 * @param reach - what they reach the catalogue through.
 */
export const catalogueTools = ({ ask, writeNew, check, shot }: CatalogueReach): readonly McpTool[] => [
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
  },
  {
    name: "check_story",
    description:
      "Run the catalogue's checks on a story in a browser, as its tests do: accessibility (axe), elements spilling out of their parents, overlays past the frame, the page's errors (a failed play among them), a story that could not be shown. Give a component's id to check all its stories. Needs @forgebook/testing and Playwright in the project.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "A story's id, or a component's for its listed stories." },
        views: {
          type: "array",
          items: { type: "string" },
          description:
            "The views to check in, each as the catalogue's address writes it (theme=dark&width=360); the default view when none."
        },
        allVariants: {
          type: "boolean",
          description: "Check every variant the catalogue's browser tests check."
        }
      },
      required: ["id"],
      additionalProperties: false
    },
    call: async (args: Readonly<Record<string, unknown>>): Promise<McpToolResult> => {
      const views = Array.isArray(args["views"])
        ? args["views"].filter((view): view is string => typeof view === "string")
        : [];
      const report = await check({
        id: textOf(args, "id") ?? "",
        views,
        isAllVariants: args["allVariants"] === true
      });
      if (typeof report === "string") return { structured: { error: report }, isError: true };
      return { structured: report, isError: report.results.some((result) => result.problems.length > 0) };
    }
  },
  {
    name: "recent_errors",
    description:
      "What the catalogue's open frames reported while you edited: stories that could not be shown and plays that failed, numbered, with the story index's problems. Give since (the last answer's last) to get only the new ones. Only frames open in a browser report; check_story checks a story without one.",
    inputSchema: {
      type: "object",
      properties: {
        since: { type: "number", description: "Only the errors after this number; every one kept when none." }
      },
      additionalProperties: false
    },
    call: async (args: Readonly<Record<string, unknown>>): Promise<McpToolResult> => {
      const since = typeof args["since"] === "number" ? args["since"] : 0;
      const document = await askErrors(ask, since);
      if (typeof document === "string") return { structured: { error: document }, isError: true };
      return { structured: document, isError: false };
    }
  },
  {
    name: "story_shot",
    description:
      "Take a story's pictures in a browser, one per view, and look at them: the answer holds the pictures themselves, and the PNG files' paths. Views are written as the catalogue's address writes them (theme=dark&width=360) or as words (\"dark it 360\"). Needs @forgebook/testing and Playwright in the project.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "A story's id, or a component's for its listed stories." },
        views: {
          type: "array",
          items: { type: "string" },
          description: "The views to picture it in; the default view when none."
        },
        allVariants: {
          type: "boolean",
          description: "Picture every variant the catalogue's browser tests check."
        }
      },
      required: ["id"],
      additionalProperties: false
    },
    call: async (args: Readonly<Record<string, unknown>>): Promise<McpToolResult> => {
      const views = Array.isArray(args["views"])
        ? args["views"].filter((view): view is string => typeof view === "string")
        : [];
      const outDir = mkdtempSync(join(tmpdir(), "forgebook-shot-"));
      const report = await shot(
        { id: textOf(args, "id") ?? "", views, isAllVariants: args["allVariants"] === true },
        outDir
      );
      if (typeof report === "string") return { structured: { error: report }, isError: true };
      const images = report.shots.map((each) => ({
        data: readFileSync(each.file).toString("base64"),
        mimeType: "image/png"
      }));
      return { structured: report, isError: false, images };
    }
  }
];
