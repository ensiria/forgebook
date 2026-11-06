/**
 * What `story_address` answers when it is given values: the links that open the story with those it takes, and what it
 * left out, checked by the catalogue as a link's values are.
 *
 * @module
 */
import { isStoryDocument } from "../../src/vite/agentApi.ts";
import type { McpToolResult } from "../../src/vite/mcpProtocol.ts";
import { type Ask, resultOf } from "./mcpToolParts.ts";

/** The tool's `args`, as an agent is told of them. */
export const SET_ARGS_PROPERTY = {
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
export const setArgsResult = async (
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
