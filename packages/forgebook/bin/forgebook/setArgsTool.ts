/**
 * `story_address`: a story's links; given values, those that open it with the ones it takes, and what it left out, checked
 * by the catalogue as a link's values are.
 *
 * @module
 */
import { isStoriesDocument, isStoryDocument } from "../../src/vite/agentApi.ts";
import { namedStory } from "../../src/vite/agentIds.ts";
import type { McpTool, McpToolResult } from "../../src/vite/mcpProtocol.ts";
import { type Ask, resultOf, textOf, VIEW } from "./mcpToolParts.ts";

/** The tool's `args`, as an agent is told of them. */
const SET_ARGS_PROPERTY = {
  type: "object",
  description:
    'Values to set, by prop, as plain JSON: nested objects and lists as their shape says, `{ "of": type, "named": name }` for a named value, `{ "forgebookUnset": true }` for no value over the story\'s own.'
};

/**
 * The answer.
 *
 * @param ask - asks the catalogue.
 * @param id - the story's id.
 * @param view - the view the links open in.
 * @param values - the values, as the tool received them.
 */
const setArgsResult = async (
  ask: Ask,
  id: string,
  view: string | undefined,
  values: unknown
): Promise<McpToolResult> => {
  const params = new URLSearchParams({ id, view: view ?? "", args: JSON.stringify(values) });
  const answer = await ask("story", params);
  if (answer.status !== 200 || !isStoryDocument(answer.body)) return resultOf(answer);
  const { story, setArgs, problems } = answer.body;
  return {
    structured: {
      id: story.id,
      links: story.links,
      accepted: setArgs?.accepted ?? {},
      dropped: setArgs?.dropped ?? [],
      problems
    },
    isError: false
  };
};

/**
 * The tool that gives a story's links, with values when it is given some.
 *
 * @param ask - asks the catalogue.
 */
export const storyAddressTool = (ask: Ask): McpTool => ({
  name: "story_address",
  description:
    "The links that open a story in the catalogue, in its frame alone, and with no chrome for a wiki or Notion (embed), in the view asked for: give them to a person to look at what you describe. With args, the links open the story with those values, once checked as a link's are against the controls get_story lists; what it takes and what it leaves out are in the answer.",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "The story's id, as list_stories gives it." },
      view: VIEW,
      args: SET_ARGS_PROPERTY
    },
    required: ["id"],
    additionalProperties: false
  },
  call: async (args: Readonly<Record<string, unknown>>): Promise<McpToolResult> => {
    const id = textOf(args, "id") ?? "";
    if (args["args"] !== undefined) return setArgsResult(ask, id, textOf(args, "view"), args["args"]);
    const answer = await ask("stories", new URLSearchParams({ view: textOf(args, "view") ?? "" }));
    if (answer.status !== 200 || !isStoriesDocument(answer.body)) return resultOf(answer);
    const named = namedStory(answer.body, id);
    return named === undefined
      ? { structured: { error: `No story "${id}"` }, isError: true }
      : { structured: { id: named.story.id, links: named.story.links }, isError: false };
  }
});
