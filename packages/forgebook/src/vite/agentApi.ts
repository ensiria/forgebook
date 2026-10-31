/**
 * The documents the catalogue answers tools and agents with, made from what the pages use: the story tree, a story's
 * module as the frame reads it, its component's docs as the props panel reads them. Pure: values in, documents out;
 * the dev server loads the modules and hands them here.
 *
 * @module
 */

import { type ComponentDocs, isComponentDocs } from "../componentDocs.ts";
import { type LoadedPreview, NO_PREVIEW, readStory } from "../frame/storyModule.ts";
import { componentId, type StoryLocation, type StoryTree, type TreeStory } from "../storyTree.ts";
import { frameAddressOf, storyAddressOf } from "../viewState.ts";
import type {
  AgentComponent,
  AgentStory,
  StoriesDocument,
  StoryDocument,
  StoryLinks
} from "./agent.types.ts";

/** Where the catalogue is served, for the links: its page and its frame page. */
export type CataloguePages = {
  /** The catalogue's page (`http://localhost:5173/`). */
  readonly page: string;
  /** The frame page (`http://localhost:5173/frame.html`). */
  readonly frame: string;
};

/**
 * A story's links in a view.
 *
 * @param pages - where the catalogue is served.
 * @param id - the story's id.
 * @param view - the view's query (`theme=dark&lang=it`); empty for the default view.
 */
export const storyLinks = (pages: CataloguePages, id: string, view: string): StoryLinks => ({
  address: storyAddressOf(pages.page, id, view),
  frame: frameAddressOf(pages.frame, id, view)
});

/** A story of the tree as the documents give it. */
const agentStory = (
  story: TreeStory,
  isUnlisted: boolean,
  pages: CataloguePages,
  view: string
): AgentStory => ({
  id: story.id,
  name: story.name,
  exportName: story.exportName,
  description: story.description,
  tags: story.tags,
  isUnlisted,
  links: storyLinks(pages, story.id, view)
});

/** A component of the tree as the documents give it, its listed stories first. */
const agentComponent = (
  location: Omit<StoryLocation, "story">,
  pages: CataloguePages,
  view: string
): AgentComponent => {
  const { source, component } = location;
  return {
    id: componentId(source.id, component.title),
    title: component.title,
    source: source.id,
    file: component.file,
    stories: [
      ...component.stories.map((story) => agentStory(story, false, pages, view)),
      ...component.unlisted.map((story) => agentStory(story, true, pages, view))
    ]
  };
};

/**
 * The stories a catalogue has.
 *
 * @param title - the catalogue's name.
 * @param tree - its story tree.
 * @param pages - where it is served, for the links.
 * @param view - the view the links open in; empty for the default view.
 */
export const storiesDocument = (
  title: string,
  tree: StoryTree,
  pages: CataloguePages,
  view: string
): StoriesDocument => ({
  schema: 1,
  title,
  sources: tree.sources.map((source) => ({ id: source.id, name: source.name })),
  components: tree.sources.flatMap((source) =>
    source.families.flatMap((family) =>
      family.groups.flatMap((group) =>
        group.components.map((component) => agentComponent({ source, family, group, component }, pages, view))
      )
    )
  ),
  problems: tree.problems
});

/**
 * A value as JSON keeps it: functions, symbols, `undefined` and cycles dropped, so a story's args can be printed
 * whatever a story passes (an `fn()` spy, a React element is an object and stays as its JSON).
 *
 * @param value - any value.
 */
export const jsonValue = (value: unknown): unknown => {
  const seen = new WeakSet<object>();
  const text = JSON.stringify(value, (_key, item: unknown): unknown => {
    if (typeof item === "function" || typeof item === "symbol" || typeof item === "bigint") return undefined;
    if (typeof item === "object" && item !== null) {
      if (seen.has(item)) return undefined;
      seen.add(item);
    }
    return item;
  });
  return text === undefined ? undefined : JSON.parse(text);
};

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** What the dev server loaded for one story, for `storyDocument`. */
export type LoadedStoryParts = {
  /** The story file's module, or why it failed to load. */
  readonly module: { readonly value: unknown } | { readonly error: string };
  /** What the docs loader gave, or why it failed. */
  readonly docs: { readonly value: unknown } | { readonly error: string };
  /** The catalogue's previews merged, whose args are under every story's. */
  readonly preview?: LoadedPreview;
};

/** The docs a story file's docs loader gave, as a document field, with the problem when there is one. */
const docsOf = (
  loaded: LoadedStoryParts["docs"]
): { readonly docs: ComponentDocs | undefined; readonly problem: string | undefined } => {
  if ("error" in loaded) return { docs: undefined, problem: `Its component's docs failed: ${loaded.error}` };
  const { value } = loaded;
  if (isComponentDocs(value)) return { docs: value, problem: undefined };
  if (typeof value === "object" && value !== null && "error" in value && typeof value.error === "string")
    return { docs: undefined, problem: `Its component's docs failed: ${value.error}` };
  return { docs: undefined, problem: undefined };
};

/**
 * One story in detail.
 *
 * @param location - the story's place in the tree.
 * @param parts - its module and its docs, as the dev server loaded them.
 * @param pages - where the catalogue is served, for the links.
 * @param view - the view the links open in; empty for the default view.
 */
export const storyDocument = (
  location: StoryLocation,
  parts: LoadedStoryParts,
  pages: CataloguePages,
  view: string
): StoryDocument => {
  const component = agentComponent(location, pages, view);
  const story =
    component.stories.find((each) => each.id === location.story.id) ??
    agentStory(location.story, false, pages, view);
  const problems: string[] = [];
  let args: Readonly<Record<string, unknown>> = {};
  if ("error" in parts.module) problems.push(`Its story file failed to load: ${parts.module.error}`);
  else {
    const read = readStory(parts.module.value, location.story.exportName, parts.preview ?? NO_PREVIEW);
    if (typeof read === "string") problems.push(read);
    else {
      const json = jsonValue(read.args);
      if (isRecord(json)) args = json;
    }
  }
  const { docs, problem } = docsOf(parts.docs);
  if (problem !== undefined) problems.push(problem);
  return {
    schema: 1,
    story,
    component: { id: component.id, title: component.title, source: component.source, file: component.file },
    docs,
    args,
    problems
  };
};

/** Which part of the catalogue a list keeps. */
export type StoriesFilter = {
  /** A source's id; every source when none. */
  readonly source?: string | undefined;
  /** Text a component's title holds, any case (`button`); every component when none. */
  readonly component?: string | undefined;
};

/**
 * The stories document cut to the components a filter keeps; its sources and problems kept whole.
 *
 * @param document - the stories document.
 * @param filter - the source and the text to keep.
 */
export const filteredStories = (document: StoriesDocument, filter: StoriesFilter): StoriesDocument => {
  const text = filter.component?.toLowerCase();
  return {
    ...document,
    components: document.components.filter(
      (component) =>
        (filter.source === undefined || component.source === filter.source) &&
        (text === undefined || component.title.toLowerCase().includes(text))
    )
  };
};

/**
 * Whether a value is the stories document, as a client receives it over HTTP.
 *
 * @param value - the answer's body.
 */
export const isStoriesDocument = (value: unknown): value is StoriesDocument =>
  isRecord(value) &&
  value["schema"] === 1 &&
  Array.isArray(value["components"]) &&
  Array.isArray(value["problems"]);

/**
 * Whether a value is the story document, as a client receives it over HTTP.
 *
 * @param value - the answer's body.
 */
export const isStoryDocument = (value: unknown): value is StoryDocument =>
  isRecord(value) && value["schema"] === 1 && isRecord(value["story"]) && Array.isArray(value["problems"]);
