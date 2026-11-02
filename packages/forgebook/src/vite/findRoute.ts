/**
 * The answer to an intent search: the components found, each with when to use it and its first story's links.
 *
 * @module
 */
import type { StorySource } from "@forgebook/story-format/source";

import { isComponentDocs, type UsageGuidance } from "../componentDocs.ts";
import { sourceFiles } from "../sourceFiles.ts";
import { componentId, type StoryTree, type TreeComponent, type TreeSource } from "../storyTree.ts";
import type { AgentFoundComponent, FoundComponentsDocument } from "./agent.types.ts";
import { storyLinks } from "./agentApi.ts";
import type { IndexedComponent } from "./agentIndex.ts";
import { type AgentAnswer, type RouteContext, settled } from "./agentRoutes.ts";
import { type FindableComponent, findComponents } from "./findComponent.ts";

/** Every component of the tree, with its source. */
const treeComponents = (
  tree: StoryTree
): readonly { readonly source: TreeSource; readonly component: TreeComponent }[] =>
  tree.sources.flatMap((source) =>
    source.families.flatMap((family) =>
      family.groups.flatMap((group) => group.components.map((component) => ({ source, component })))
    )
  );

/** What a component's docs say of when to use it; none when they cannot be read, which never loses the result. */
const guidanceOfComponent = async (
  source: StorySource | undefined,
  file: string
): Promise<UsageGuidance | undefined> => {
  if (source === undefined) return undefined;
  const loaded = await settled(sourceFiles(source).docs[file]);
  const value = "value" in loaded ? loaded.value : undefined;
  return isComponentDocs(value) ? value.guidance : undefined;
};

/** A component of the tree as the search reads it. */
const findableOf = (source: TreeSource, component: TreeComponent): FindableComponent => ({
  id: componentId(source.id, component.title),
  title: component.title,
  keywords: component.keywords,
  stories: component.stories.map((story) => `${story.name} ${story.description ?? ""}`)
});

/**
 * Every component as a search reads it, with what its answer carries, for a catalogue's index.
 *
 * @param context - what the routes read.
 */
export const indexedComponents = ({ tree, loaded }: RouteContext): Promise<readonly IndexedComponent[]> =>
  Promise.all(
    treeComponents(tree).map(async ({ source, component }): Promise<IndexedComponent> => {
      const loadedSource = loaded.sources.find((each) => each.id === source.id);
      const guidance = await guidanceOfComponent(loadedSource, component.file);
      return {
        ...findableOf(source, component),
        story: component.stories[0]?.id,
        ...(guidance === undefined ? {} : { guidance })
      };
    })
  );

/**
 * The components a query describes, with their guidance and the links of their first story.
 *
 * @param context - what the routes read.
 */
export const findAnswer = async ({
  tree,
  params,
  pages,
  view,
  loaded
}: RouteContext): Promise<AgentAnswer> => {
  const query = params.get("query") ?? "";
  if (query.trim() === "") return { status: 400, body: { error: "No words to look for" } };
  const located = treeComponents(tree);
  const findable = located.map(({ source, component }) => findableOf(source, component));
  const components = await Promise.all(
    findComponents(findable, query).map(async (found): Promise<AgentFoundComponent> => {
      const place = located.find(
        ({ source, component }) => componentId(source.id, component.title) === found.id
      );
      const story = place?.component.stories[0]?.id;
      const source = loaded.sources.find((each) => each.id === place?.source.id);
      const guidance =
        place === undefined ? undefined : await guidanceOfComponent(source, place.component.file);
      return {
        ...found,
        story,
        links: story === undefined ? undefined : storyLinks(pages, story, view),
        ...(guidance === undefined ? {} : { guidance })
      };
    })
  );
  const body: FoundComponentsDocument = { schema: 1, query, components };
  return { status: 200, body };
};
