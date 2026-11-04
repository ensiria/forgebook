/**
 * Writes a catalogue's index from the answers a dev server gives, so a built catalogue says what a running one says.
 *
 * @module
 */
import type { StoryDocument } from "./agent.types.ts";
import { isStoriesDocument, isStoryDocument } from "./agentApi.ts";
import type { AgentIndex } from "./agentIndex.ts";
import { type AgentAnswer, type RouteContext, storiesAnswer, storyAnswer } from "./agentRoutes.ts";
import { indexedComponents } from "./findRoute.ts";
import type { TokenReading } from "./tokenAnswers.ts";

/**
 * The whole catalogue, as one document.
 *
 * @param context - what the routes read.
 * @param tokens - the tokens, read.
 * @returns the index, with the stories that could not be answered at all in its problems.
 */
export const agentIndexAnswer = async (context: RouteContext, tokens: TokenReading): Promise<AgentAnswer> => {
  const listed = await storiesAnswer({ ...context, params: new URLSearchParams({ usedIn: "true" }) });
  if (!isStoriesDocument(listed.body)) return listed;
  const stories = listed.body;
  const ids = stories.components.flatMap((component) => component.stories.map((story) => story.id));
  const details: Record<string, StoryDocument> = {};
  const problems: string[] = [];
  for (const id of ids) {
    const answer = await storyAnswer({ ...context, params: new URLSearchParams({ id }) });
    if (answer.status === 200 && isStoryDocument(answer.body)) details[id] = answer.body;
    else problems.push(`${id}: ${JSON.stringify(answer.body)}`);
  }
  const body: AgentIndex = {
    schema: 1,
    stories,
    details,
    findable: await indexedComponents(context),
    tokens,
    problems
  };
  return { status: 200, body };
};
