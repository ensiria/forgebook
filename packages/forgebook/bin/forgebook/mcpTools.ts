/**
 * The tools `forgebook mcp` offers agents, each answered as the command of the same name answers: `list_stories`,
 * `find_component`, `changed_stories`, `get_story`, `story_address`, `new_stories`, `check_story`, `recent_errors`, `story_shot`, `check_code`, `verify`, `list_tokens`, `get_token`,
 * `nearest_token`, `component_graph`, `list_pages`, `get_page`, `search_catalogue`, `list_plugins` and `list_switches`; and `story_preview` (`mcpPreview.ts`),
 * for a client that renders apps. `visual_diff` and `get_guide` join them in `mcpCommand.mts`.
 *
 * @module
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { StoryCheckReport, StoryShotReport, StressReport } from "../../src/storyCheck.ts";
import type { PluginsDocument, SwitchesDocument } from "../../src/vite/agent.types.ts";
import { filteredStories, isStoriesDocument } from "../../src/vite/agentApi.ts";
import type { AgentAnswer } from "../../src/vite/agentRoutes.ts";
import type { McpTool, McpToolResult } from "../../src/vite/mcpProtocol.ts";
import { askErrors } from "./errorsRun.ts";
import { graphTool } from "./mcpGraph.ts";
import { previewTool } from "./mcpPreview.ts";
import { tokenTools } from "./mcpTokens.ts";
import { type Ask, resultOf, textOf, textsOf, VIEW } from "./mcpToolParts.ts";
import { type Verify, verifyTool } from "./mcpVerify.ts";
import type { NewStoriesFile } from "./newStoriesFile.ts";
import { pageTools } from "./pageTools.ts";
import { storyAddressTool } from "./setArgsTool.ts";
import type { StoryCheckInput } from "./storyCheckRun.ts";
import { stressToolResult } from "./stressText.ts";

/** The session's folder for pictures; made on the first call. */
let shotsDir: string | undefined;

/**
 * The folder a picture run writes in: one for the session, emptied before each run, so the last pictures stay to be
 * read and none pile up.
 */
const shotsFolder = (): string => {
  shotsDir ??= mkdtempSync(join(tmpdir(), "forgebook-shot-"));
  rmSync(shotsDir, { recursive: true, force: true });
  mkdirSync(shotsDir, { recursive: true });
  return shotsDir;
};

/** Writes a component's first stories, as `forgebook new --print` does. */
type NewStories = (file: string, exportName: string | undefined) => Promise<NewStoriesFile>;

/** Runs the catalogue's checks on a story in a browser: the report, or why it could not run. */
type Check = (input: StoryCheckInput) => Promise<StoryCheckReport | string>;

/** Takes a story's pictures into a folder: the report, or why they could not be taken. */
type Shot = (input: StoryCheckInput, outDir: string) => Promise<StoryShotReport | string>;

/** An answer as a tool's result that fails on what it found, as the command of the same name does. */
const problemsResult = (answer: AgentAnswer): McpToolResult => {
  const result = resultOf(answer);
  const body = answer.body;
  const hasProblems =
    typeof body === "object" &&
    body !== null &&
    "problems" in body &&
    Array.isArray(body.problems) &&
    body.problems.length > 0;
  return { ...result, isError: result.isError || hasProblems };
};

/** What the tools reach the catalogue through. */
export type CatalogueReach = {
  /** The plugins the configuration lists. */
  readonly plugins: PluginsDocument;
  /** The switches the configuration declares, the ready-made ones among them. */
  readonly switches: SwitchesDocument;
  /** Asks the catalogue (the running dev server, or the server `forgebook mcp` keeps). */
  readonly ask: Ask;
  /** Writes a component's first stories, the file relative to the catalogue's folder. */
  readonly writeNew: NewStories;
  /** Runs the checks on a story. */
  readonly check: Check;
  /** Runs the stress matrix on a story: worst-case values and views it never declared. */
  readonly stress: (id: string) => Promise<StressReport | string>;
  /** Takes a story's pictures. */
  readonly shot: Shot;
  /** Answers whether a change is verified. */
  readonly verify: Verify;
  /** Runs the checks on a page of the application. */
  readonly checkPage: (address: string) => Promise<StoryCheckReport | string>;
  /** Serves the catalogue where a browser can open a preview, and answers where. */
  readonly servePreview: () => Promise<string>;
};

/**
 * The tools.
 *
 * @param reach - what they reach the catalogue through.
 */
export const catalogueTools = ({
  ask,
  writeNew,
  check,
  stress,
  shot,
  verify,
  checkPage,
  servePreview,
  plugins,
  switches
}: CatalogueReach): readonly McpTool[] => [
  ...pageTools(ask),
  {
    name: "list_plugins",
    description:
      "The plugins this catalogue lists and what each adds: panel tabs (open one with tab=<id> in a view), switches, docs blocks. A tab needs its plugin: a story's parameter does nothing without it.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    call: async (): Promise<McpToolResult> => ({ structured: plugins, isError: false })
  },
  {
    name: "list_switches",
    description:
      "The switches this catalogue offers and their values, each with the view that draws it (look=night), what it implies on other switches, its style sheet and its gallery preview. get_guide with topic switches explains them.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    call: async (): Promise<McpToolResult> => ({ structured: switches, isError: false })
  },
  {
    name: "check_page",
    description:
      "Run the catalogue's checks on a real page of the application in a browser: accessibility, what spills, console and page errors. Use it on the screen you built; for a story, check_story.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "The page's address, as http://localhost:3000/checkout." }
      },
      required: ["address"],
      additionalProperties: false
    },
    call: async (args: Readonly<Record<string, unknown>>): Promise<McpToolResult> => {
      const report = await checkPage(textOf(args, "address") ?? "");
      return typeof report === "string"
        ? { structured: { error: report }, isError: true }
        : { structured: report, isError: false };
    }
  },
  {
    name: "changed_stories",
    description:
      "The stories a change touches: every story that reaches a file git says changed, through the imports, and each changed UI file with its stories. To check them, call verify.",
    inputSchema: {
      type: "object",
      properties: {
        since: {
          type: "string",
          description: "The commit to compare with; HEAD by default, so what is not committed."
        }
      },
      additionalProperties: false
    },
    call: async (args: Readonly<Record<string, unknown>>): Promise<McpToolResult> =>
      resultOf(await ask("changed", new URLSearchParams({ since: textOf(args, "since") ?? "" })))
  },
  {
    name: "find_component",
    description:
      'The components a description fits, best first, in your own words ("modal", "radio tile group"): call it before writing a component that may already exist. Each with the words it matched and missed, when to use it, and its first story.',
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "What you are looking for, in any words." } },
      required: ["query"],
      additionalProperties: false
    },
    call: async (args: Readonly<Record<string, unknown>>): Promise<McpToolResult> =>
      resultOf(await ask("find", new URLSearchParams({ query: textOf(args, "query") ?? "" })))
  },
  {
    name: "check_code",
    description:
      "Check what your change adds, new files included, for colours and sizes written by hand, with the token to use, checks turned off with no reason, and deleted tests. With no tokens file it compares with what the application declares (CSS variables, Tailwind, components.json); `tokenSources` says what was read. It also names an added import of a component marked @deprecated or @replacedBy, and a new component that looks like one that exists; `advice` is what to weigh, not a failure. It does not check props, so a clean answer is not a review. `skipped` says what it could not check.",
    inputSchema: {
      type: "object",
      properties: {
        since: {
          type: "string",
          description: "The commit to compare with; HEAD by default, so what is not committed."
        }
      },
      additionalProperties: false
    },
    call: async (args: Readonly<Record<string, unknown>>): Promise<McpToolResult> =>
      problemsResult(await ask("check-code", new URLSearchParams({ since: textOf(args, "since") ?? "" })))
  },
  verifyTool(verify),
  graphTool(ask),
  ...tokenTools(ask),
  {
    name: "list_stories",
    description:
      "List the catalogue's components and stories, with each story's id and the links that open it, and the problems the story index found. Filter by source id or by text in a component's title.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "Only this source's stories (its id)." },
        component: { type: "string", description: "Only components whose title holds this text, any case." },
        tags: {
          type: "array",
          items: { type: "string" },
          description: 'Only stories with any of these tags; "!name" leaves a tag\'s out.'
        },
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
      const filter = {
        source: textOf(args, "source"),
        component: textOf(args, "component"),
        tags: textsOf(args, "tags")
      };
      return { structured: filteredStories(answer.body, filter), isError: false };
    }
  },
  {
    name: "get_story",
    description:
      "One story in detail: the names of the props every use must set (requiredProps, first), its args as the catalogue renders it, its code as the Code tab shows it (code: the render or the args as written), the props its values can set (controls: each one's control and the shape of its value), its component's props in the order of the source (types, defaults, descriptions; onlyWhen for a variant's prop, notes when a type is generic or unread, propsNote when none are listed), the components whose stories use it (usedIn), the device it is shown in by default (device), its design in Figma when it has one (design: the link, the file key and the node id, and the address where a person sees it beside the story), its links in the view asked for, and what failed while reading it.",
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
  storyAddressTool(ask),
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
      "Run the catalogue's checks on a story in a browser, as its tests do: accessibility (axe), elements spilling out of their parents, overlays past the frame, the page's errors (a failed play among them), a story that could not be shown; `notVerified` on a result means its frame gave up on what the story loads and no check ran, which is an error too. Give a component's id to check all its stories. Needs @forgebook/testing and Playwright in the project.",
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
        },
        semantic: {
          type: "boolean",
          description:
            "Also ask the model the user configured whether headings, labels and alternatives say the right thing. Its judgements are opinions, in `judgements`."
        },
        stress: {
          type: "boolean",
          description:
            "Draw it with worst-case values instead of checking it as written (alone: no views, allVariants or semantic), and with views it never declared (long-text, unbreakable, empty, huge-number, rtl, zoom-200, narrow, dark, contrast), with no story written: each case lists only what it breaks that the plain story does not; `skipped` names cases with nothing to set."
        }
      },
      required: ["id"],
      additionalProperties: false
    },
    call: async (args: Readonly<Record<string, unknown>>): Promise<McpToolResult> => {
      const views = Array.isArray(args["views"])
        ? args["views"].filter((view): view is string => typeof view === "string")
        : [];
      if (args["stress"] === true) return stressToolResult(stress, args);
      const report = await check({
        id: textOf(args, "id") ?? "",
        views,
        isAllVariants: args["allVariants"] === true,
        isSemantic: args["semantic"] === true
      });
      if (typeof report === "string") return { structured: { error: report }, isError: true };
      return {
        structured: report,
        isError: report.results.some(
          (result) => result.problems.length > 0 || result.notVerified !== undefined
        )
      };
    }
  },
  {
    name: "recent_errors",
    description:
      "What the catalogue's open frames reported while you edited: stories that could not be shown (with place, the file:line:column as written) and plays that failed, numbered, with the story index's problems. Give since (the last answer's last) to get only the new ones. Only frames open in a browser report; check_story checks a story without one.",
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
      'Take a story\'s pictures in a browser, one per view, and look at them: the answer holds the pictures themselves, and the PNG files\' paths. Views are written as the catalogue\'s address writes them (theme=dark&width=360) or as words ("dark it 360"); a device model\'s id in a view ("iphone-16", "pixel-9 landscape") frames the picture in that device. Needs @forgebook/testing and Playwright in the project.',
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
      const outDir = shotsFolder();
      const report = await shot(
        { id: textOf(args, "id") ?? "", views, isAllVariants: args["allVariants"] === true },
        outDir
      );
      if (typeof report === "string") return { structured: { error: report }, isError: true };
      const images = report.shots.map((each) => ({
        data: readFileSync(each.file).toString("base64"),
        mimeType: "image/png"
      }));
      return { structured: report, isError: report.shots.some((each) => each.status !== undefined), images };
    }
  },
  previewTool({ ask, serve: servePreview })
];
