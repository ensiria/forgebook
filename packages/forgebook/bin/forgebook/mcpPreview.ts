/**
 * The inline preview `forgebook mcp` offers a client that renders apps (MCP Apps, specification 2026-01-26): the tool
 * `story_preview` and the `ui://` resource its answer is shown in.
 *
 * @remarks
 * Nothing here runs for a client that renders no apps: the tool is not listed to it, and it keeps `story_shot`. For one
 * that does, the order follows what the specification lets a host do: it may read the resource at any time, so a read
 * starts nothing; the catalogue is served when the tool is called; and the story's own code loads in the host's frame
 * when the page sets the address the answer gives. The page's source is imported at the first read.
 *
 * @module
 */
import { isStoriesDocument } from "../../src/vite/agentApi.ts";
import { AGENT_API, type AgentAnswer } from "../../src/vite/agentRoutes.ts";
import type { McpAppContent, McpAppResource, McpTool, McpToolResult } from "../../src/vite/mcpProtocol.ts";
import { PREVIEW_ROUTE } from "../../src/vite/previewRoute.ts";

/** The address of the page a preview is shown in. */
export const PREVIEW_URI = "ui://forgebook/story-preview";

/** The MCP Apps version the page speaks, the extension's own and apart from the protocol's. */
const APPS_VERSION = "2026-01-26";

/** The tool that takes the picture a host that cannot show the story gets instead. */
const SHOT_TOOL = "story_shot";

/** How long a story may stay silent before its picture is asked for, in ms: long enough for a cold dev server. */
const SILENCE_MS = 20_000;

/** The tool's name. */
const PREVIEW_TOOL = "story_preview";

/** A link on another origin: a server of the command's own serves on its own port, not where the links say. */
const linkAt = (origin: string, link: string): string => {
  const { pathname, search } = new URL(link);
  return `${origin}${pathname}${search}`;
};

/** What the tool reaches the catalogue through. */
export type PreviewReach = {
  /** Asks the catalogue. */
  readonly ask: (route: string, params: URLSearchParams) => Promise<AgentAnswer>;
  /** Serves the catalogue where a browser can open it, and answers where. */
  readonly serve: () => Promise<string>;
};

/**
 * The tool that shows a story to the person, inside the client.
 *
 * @param reach - what it reaches the catalogue through.
 */
export const previewTool = ({ ask, serve }: PreviewReach): McpTool => ({
  name: PREVIEW_TOOL,
  description: `Show a story to the person, live, inside this conversation. You do not see it: to look at it yourself call ${SHOT_TOOL}.`,
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "The story's id, as list_stories gives it." },
      view: {
        type: "string",
        description:
          "The view to show it in, as the catalogue's address writes it (theme=dark&lang=it); none for the default."
      }
    },
    required: ["id"],
    additionalProperties: false
  },
  appResource: PREVIEW_URI,
  call: async (args: Readonly<Record<string, unknown>>): Promise<McpToolResult> => {
    const id = typeof args["id"] === "string" ? args["id"] : "";
    const view = typeof args["view"] === "string" ? args["view"] : "";
    const answer = await ask("stories", new URLSearchParams({ view }));
    if (answer.status !== 200 || !isStoriesDocument(answer.body))
      return { structured: answer.body, isError: true };
    const story = answer.body.components
      .flatMap((component) => component.stories)
      .find((each) => each.id === id);
    if (story === undefined) return { structured: { error: `No story "${id}"` }, isError: true };
    const origin = await serve();
    const preview = `${origin}${AGENT_API}${PREVIEW_ROUTE}?${new URLSearchParams({ id, view }).toString()}`;
    return {
      structured: {
        id,
        preview,
        links: { address: linkAt(origin, story.links.address), frame: linkAt(origin, story.links.frame) }
      },
      isError: false
    };
  }
});

/** What the resource is made from. */
export type PreviewResourceOptions = {
  /** Where the story will be served, with nothing started. */
  readonly origin: () => Promise<string>;
  /** The catalogue's `strings`, which replace the page's words by name. */
  readonly strings: Readonly<Record<string, string>>;
  /** Forgebook's version. */
  readonly version: string;
};

/**
 * The resource a preview is shown in.
 *
 * @param options - what it is made from.
 */
export const previewResource = ({ origin, strings, version }: PreviewResourceOptions): McpAppResource => ({
  uri: PREVIEW_URI,
  name: "story_preview",
  description: "A story of the catalogue, live, or its picture when the client cannot show it live.",
  read: async (): Promise<McpAppContent> => {
    const { previewViewPage } = await import("../../src/vite/previewPages.ts");
    const { previewTexts } = await import("../../src/previewTexts.ts");
    return {
      html: previewViewPage({
        texts: previewTexts(strings),
        version,
        protocolVersion: APPS_VERSION,
        shotTool: SHOT_TOOL,
        silenceMs: SILENCE_MS
      }),
      frameDomains: [await origin()]
    };
  }
});
