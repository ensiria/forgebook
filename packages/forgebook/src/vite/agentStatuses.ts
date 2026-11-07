/**
 * The statuses in the agents' answers: each story's and each component's (`statuses`), and in a story's answer where its
 * component's TSDoc and its meta disagree about deprecation.
 *
 * @remarks
 * A deprecated component has two places to say so: `@deprecated` in its TSDoc, which `check_code` reads to warn where
 * it is imported, and a `deprecated` tag on its meta, which the sidebar, the page and the tag filter read without
 * building its types. A story's answer reads both, so it gives the component as deprecated when either says it, and
 * names the place that does not, so the two are made to agree instead of one being trusted over the other. Pure.
 *
 * @module
 */
import type { ComponentDocs } from "../componentDocs.ts";
import { type CatalogueStatus, DEPRECATED_STATUS, statusesOf } from "../storyStatuses.ts";
import type { StoryTree, TreeComponent } from "../storyTree.ts";
import type { StoriesDocument, StoryDocument } from "./agent.types.ts";

/** The ids of the statuses a list of tags holds. */
const statusIds = (tags: readonly string[], statuses: readonly CatalogueStatus[]): readonly string[] =>
  statusesOf(tags, statuses).map((status) => status.id);

/** A value with its statuses, or as it is when it has none: an answer stays short for what has none. */
const withStatus = <TValue extends object>(
  value: TValue,
  statuses: readonly string[]
): TValue & { readonly statuses?: readonly string[] } =>
  statuses.length === 0 ? value : { ...value, statuses };

/**
 * The stories document with each component's and each story's statuses.
 *
 * @param document - the stories document.
 * @param tree - the tree it was made from, whose components hold their meta's tags.
 * @param statuses - the catalogue's statuses.
 */
export const storiesWithStatus = (
  document: StoriesDocument,
  tree: StoryTree,
  statuses: readonly CatalogueStatus[]
): StoriesDocument => {
  if (statuses.length === 0) return document;
  const tagsById = new Map(
    tree.sources.flatMap((source) =>
      source.families.flatMap((family) =>
        family.groups.flatMap((group) =>
          group.components.map((component) => [component.id, component.tags] as const)
        )
      )
    )
  );
  return {
    ...document,
    components: document.components.map((component) => ({
      ...withStatus(component, statusIds(tagsById.get(component.id) ?? [], statuses)),
      stories: component.stories.map((story) => withStatus(story, statusIds(story.tags, statuses)))
    }))
  };
};

/**
 * What a component's TSDoc and its meta say of its deprecation, when they disagree: the sentence that names the place
 * to change; none when they agree, when the catalogue has no `deprecated` status, or when there are no docs to read.
 *
 * @param title - the component's title.
 * @param isTagged - whether its meta holds the `deprecated` tag.
 * @param docs - its docs; none when they are not read.
 */
export const deprecationMismatch = (
  title: string,
  isTagged: boolean,
  docs: ComponentDocs | undefined
): string | undefined => {
  if (docs === undefined) return undefined;
  const isDocumented = docs.guidance?.deprecated !== undefined;
  if (isDocumented && !isTagged)
    return `${title} is @deprecated in its TSDoc, but its meta has no "${DEPRECATED_STATUS}" tag: add tags: ["${DEPRECATED_STATUS}"] to its meta, so the sidebar, its page and the tag filter say so too`;
  if (isTagged && !isDocumented)
    return `${title}'s meta is tagged "${DEPRECATED_STATUS}", but its TSDoc has no @deprecated: add one (and @replacedBy when something replaces it), so check_code warns where it is imported`;
  return undefined;
};

/**
 * A story's answer with its statuses and its component's, the component deprecated when its TSDoc says so, and the
 * disagreement between the two among the problems.
 *
 * @param document - the story's answer.
 * @param component - its component in the tree, which holds its meta's tags.
 * @param statuses - the catalogue's statuses.
 */
export const storyWithStatus = (
  document: StoryDocument,
  component: TreeComponent,
  statuses: readonly CatalogueStatus[]
): StoryDocument => {
  if (statuses.length === 0) return document;
  const own = statusIds(component.tags, statuses);
  const hasDeprecated = statuses.some((status) => status.id === DEPRECATED_STATUS);
  const mismatch = hasDeprecated
    ? deprecationMismatch(component.title, own.includes(DEPRECATED_STATUS), document.docs)
    : undefined;
  const isDocumented = document.docs?.guidance?.deprecated !== undefined;
  const status =
    hasDeprecated && isDocumented ? statusIds([...component.tags, DEPRECATED_STATUS], statuses) : own;
  return {
    ...document,
    story: withStatus(document.story, statusIds(document.story.tags, statuses)),
    component: withStatus(document.component, status),
    problems: mismatch === undefined ? document.problems : [...document.problems, mismatch]
  };
};
