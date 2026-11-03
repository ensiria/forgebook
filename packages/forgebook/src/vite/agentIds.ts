/**
 * Finds a component or a story of the stories' document by an id, the id an earlier rule gave it included, for the
 * commands that read the document rather than the tree (`forgebook check`, `forgebook shot`, `forgebook diff`, the
 * `story_links` tool).
 *
 * @remarks
 * The tree finds a former id itself (`findStory`); the document carries only the current ids, so the former ones are
 * worked out from each component's source and title and each story's export, by the same rule. Pure.
 *
 * @module
 */
import { formerComponentId, formerStoryId } from "../storyTree.ts";
import type { AgentComponent, AgentStory, StoriesDocument } from "./agent.types.ts";

/**
 * The component an id names: by its id, else by the id the former rule gave it.
 *
 * @param document - the catalogue's stories.
 * @param id - the id.
 */
export const namedComponent = (document: StoriesDocument, id: string): AgentComponent | undefined =>
  document.components.find((component) => component.id === id) ??
  document.components.find((component) => formerComponentId(component.source, component.title) === id);

/**
 * The story an id names, with its component: by its id, else by the id the former rule gave it.
 *
 * @param document - the catalogue's stories.
 * @param id - the id.
 */
export const namedStory = (
  document: StoriesDocument,
  id: string
): { readonly component: AgentComponent; readonly story: AgentStory } | undefined => {
  const stories = document.components.flatMap((component) =>
    component.stories.map((story) => ({ component, story }))
  );
  return (
    stories.find(({ story }) => story.id === id) ??
    stories.find(
      ({ component, story }) => formerStoryId(component.source, component.title, story.exportName) === id
    )
  );
};

/**
 * The id the former rule gave a story of the document, when it differs from its id: its pictures may still carry it.
 *
 * @param component - the story's component.
 * @param story - the story.
 */
export const formerIdOf = (component: AgentComponent, story: AgentStory): string | undefined => {
  const former = formerStoryId(component.source, component.title, story.exportName);
  return former === story.id ? undefined : former;
};
