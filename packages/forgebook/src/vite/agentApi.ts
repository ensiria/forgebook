/**
 * The documents the catalogue answers tools and agents with, made from what the pages use: the story tree, a story's
 * module as the frame reads it, its component's docs as the props panel reads them. Pure: values in, documents out;
 * the dev server loads the modules and hands them here.
 *
 * @module
 */

import type { FigmaLink } from "@forgebook/story-format/source";

import type { DroppedArgReason } from "../addressArgs.ts";
import type { AddressTexts } from "../addressTexts.ts";
import { type ComponentDocs, isComponentDocs } from "../componentDocs.ts";
import { embedAddressOf } from "../embedCode.ts";
import { panelArgsOf } from "../frame/panelValues.ts";
import { type LoadedPreview, type LoadedStory, NO_PREVIEW, readStory } from "../frame/storyModule.ts";
import { isLiveErrorReport } from "../liveErrors.ts";
import type { NamedValues } from "../namedValues.ts";
import { controlsOfParameter, excludedControls, panelArgTypesOf } from "../storyArgTypes.ts";
import {
  type CustomControlsRead,
  checkedSetArgs,
  customControlProblems,
  type SetArgs,
  type StoryDeclaration,
  storyControlsOf
} from "../storyControls.ts";
import { findComponentByTitle, type StoryLocation, type StoryTree, type TreeStory } from "../storyTree.ts";
import type { UsageIndex } from "../usedIn.ts";
import { componentAddressOf, frameAddressOf, storyAddressOf } from "../viewState.ts";
import type {
  AgentComponent,
  AgentDesign,
  AgentDesignLink,
  AgentStory,
  AgentUsingComponent,
  ChangedStoriesDocument,
  CheckedCodeDocument,
  ErrorsDocument,
  FoundComponentsDocument,
  NearestTokensDocument,
  PageDocument,
  PagesDocument,
  SearchDocument,
  StoriesDocument,
  StoryDocument,
  StoryLinks,
  TokenDocument,
  TokensDocument,
  VisibilityDocument
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
  // the last `--` ends the component's id: a source's own id may hold one
  component: componentAddressOf(pages.page, id.slice(0, id.lastIndexOf("--")), view),
  frame: frameAddressOf(pages.frame, id, view),
  embed: embedAddressOf(pages.page, id, view)
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
  file: story.file,
  exportName: story.exportName,
  description: story.description,
  tags: story.tags,
  isUnlisted,
  ...(story.height === undefined ? {} : { height: story.height }),
  isLogic: story.isLogic,
  hasPlay: story.hasPlay,
  ...(story.device === undefined ? {} : { device: story.device }),
  links: storyLinks(pages, story.id, view)
});

/** A design's link as the documents give it. */
const agentDesignLink = (link: FigmaLink): AgentDesignLink => ({
  figma: link.url,
  fileKey: link.fileKey,
  ...(link.branchKey === undefined ? {} : { branchKey: link.branchKey }),
  ...(link.nodeId === undefined ? {} : { nodeId: link.nodeId })
});

/**
 * A story's design as its document gives it.
 *
 * @param story - the story.
 * @param pages - where the catalogue is served, for the link to its Design tab.
 * @param view - the view the link opens in; empty for the default view.
 */
const agentDesign = (
  story: TreeStory,
  pages: CataloguePages,
  view: string
): { readonly design?: AgentDesign } => {
  if (story.design === undefined) return {};
  const onTab = new URLSearchParams(view);
  onTab.set("tab", "figma");
  return {
    design: {
      ...agentDesignLink(story.design),
      address: storyLinks(pages, story.id, onTab.toString()).address
    }
  };
};

/**
 * A component's "Used in" as the documents give it: the users the tree still has, by their ids and their stories' ids.
 *
 * @param tree - the story tree.
 * @param sourceId - the component's source.
 * @param usage - the source's usage.
 * @param title - the component's title.
 */
const agentUsers = (
  tree: StoryTree,
  sourceId: string,
  usage: UsageIndex,
  title: string
): AgentUsingComponent[] =>
  (usage[title] ?? []).flatMap((user) => {
    const found = findComponentByTitle(tree, sourceId, user.title)?.component;
    if (found === undefined) return [];
    const stories = [...found.stories, ...found.unlisted]
      .filter((story) => user.stories.includes(story.exportName))
      .map((story) => story.id);
    return [{ id: found.id, title: user.title, isDirect: user.isDirect, stories }];
  });

/** A component of the tree as the documents give it, its listed stories first, its "Used in" when given. */
const agentComponent = (
  location: Omit<StoryLocation, "story">,
  pages: CataloguePages,
  view: string,
  usage?: { readonly tree: StoryTree; readonly index: UsageIndex }
): AgentComponent => {
  const { source, component } = location;
  return {
    id: component.id,
    title: component.title,
    source: source.id,
    file: component.file,
    files: component.files,
    stories: [
      ...component.stories.map((story) => agentStory(story, false, pages, view)),
      ...component.unlisted.map((story) => agentStory(story, true, pages, view))
    ],
    ...(component.design === undefined ? {} : { design: agentDesignLink(component.design) }),
    ...(usage === undefined
      ? {}
      : { usedIn: agentUsers(usage.tree, source.id, usage.index, component.title) })
  };
};

/**
 * The stories a catalogue has.
 *
 * @param title - the catalogue's name.
 * @param tree - its story tree.
 * @param pages - where it is served, for the links.
 * @param view - the view the links open in; empty for the default view.
 * @param usage - each source's "Used in", by source id, when asked for.
 */
export const storiesDocument = (
  title: string,
  tree: StoryTree,
  pages: CataloguePages,
  view: string,
  usage?: ReadonlyMap<string, UsageIndex>
): StoriesDocument => ({
  schema: 1,
  title,
  sources: tree.sources.map((source) => ({ id: source.id, name: source.name })),
  components: tree.sources.flatMap((source) =>
    source.families.flatMap((family) =>
      family.groups.flatMap((group) =>
        group.components.map((component) => {
          const index = usage?.get(source.id);
          return agentComponent(
            { source, family, group, component },
            pages,
            view,
            index === undefined ? undefined : { tree, index }
          );
        })
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

/** Why a value an agent asked to set was left out, as its answer says it. */
const DROPPED_REASONS: Readonly<Record<DroppedArgReason, string>> = {
  undeclared: "the story declares no such arg, or does not let it be set",
  type: "it is not of the type its control takes (see `controls`)",
  unreadable: "it is not plain JSON",
  control: "its custom control's schema refuses it, or could not be read"
};

/** What the dev server loaded for one story, for `storyDocument`. */
export type LoadedStoryParts = {
  /** The story file's module, or why it failed to load. */
  readonly module: { readonly value: unknown } | { readonly error: string };
  /** What the docs loader gave, or why it failed. */
  readonly docs: { readonly value: unknown } | { readonly error: string };
  /** The catalogue's previews merged, whose args are under every story's. */
  readonly preview?: LoadedPreview;
  /** The source's named values; none when it names none. */
  readonly namedValues?: NamedValues | undefined;
  /** The values an agent asks to set, as JSON; none reads the story as it is. */
  readonly setArgs?: string | undefined;
  /** The custom controls' schemas, those whose module could be read, and why the others could not. */
  readonly customControls?: CustomControlsRead | undefined;
  /** How the framework's stories take a link's texts: what the shell would refuse is said here too. */
  readonly addressTexts?: AddressTexts | undefined;
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

/** The story read from its module, with what kept it from being read among the problems. */
const loadedStoryOf = (
  parts: LoadedStoryParts,
  location: StoryLocation,
  problems: string[]
): LoadedStory | undefined => {
  if ("error" in parts.module) {
    problems.push(`Its story file failed to load: ${parts.module.error}`);
    return undefined;
  }
  const read = readStory(parts.module.value, location.story.exportName, parts.preview ?? NO_PREVIEW);
  if (typeof read !== "string") return read;
  problems.push(read);
  return undefined;
};

/**
 * The custom controls a story names, read from its module before its document is made: their modules load for it.
 *
 * @param module - the story file's module, as the dev server loaded it.
 * @param location - the story's place in the tree.
 */
export const customControlNames = (
  module: LoadedStoryParts["module"],
  location: StoryLocation
): readonly string[] => {
  const loaded = loadedStoryOf({ module, docs: { value: undefined } }, location, []);
  if (loaded === undefined) return [];
  return Object.values(panelArgTypesOf(loaded.argTypes, [])).flatMap((each) => each.customControl ?? []);
};

/** What a loaded story declares of its args, as the shell reads it from the story's frame. */
const declarationOf = (
  loaded: LoadedStory,
  docs: ComponentDocs | undefined,
  { namedValues = {}, customControls }: Pick<LoadedStoryParts, "namedValues" | "customControls">
): StoryDeclaration => ({
  customSchemas: customControls?.schemas ?? {},
  props: docs?.props ?? [],
  argTypes: panelArgTypesOf(loaded.argTypes, excludedControls(loaded.parameters["controls"])),
  controls: controlsOfParameter(loaded.parameters["controls"]),
  storyArgs: panelArgsOf(loaded.args, namedValues),
  namedValues
});

/**
 * A story with the links that carry the values it takes, as a person's link would. Its frame's stays as it is: a frame
 * takes its values from the shell, which checks them, and alone it draws the story's own. Its component's page shows no
 * one story's values.
 */
const withSetArgLinks = (
  story: AgentStory,
  setArgs: SetArgs | undefined,
  pages: CataloguePages,
  view: string
): AgentStory => {
  if (setArgs === undefined || setArgs.param === "") return story;
  const query = new URLSearchParams({ args: setArgs.param }).toString();
  const links = storyLinks(pages, story.id, view === "" ? query : `${view}&${query}`);
  return { ...story, links: { ...links, frame: story.links.frame, component: story.links.component } };
};

/**
 * One story in detail.
 *
 * @param location - the story's place in the tree.
 * @param parts - its module and its docs, as the dev server loaded them.
 * @param pages - where the catalogue is served, for the links.
 * @param view - the view the links open in; empty for the default view.
 * @param usage - the tree and the story's source's "Used in", when the catalogue offers it.
 */
export const storyDocument = (
  location: StoryLocation,
  parts: LoadedStoryParts,
  pages: CataloguePages,
  view: string,
  usage?: { readonly tree: StoryTree; readonly index: UsageIndex }
): StoryDocument => {
  const component = agentComponent(location, pages, view, usage);
  const listedStory =
    component.stories.find((each) => each.id === location.story.id) ??
    agentStory(location.story, false, pages, view);
  const problems: string[] = [];
  const loaded = loadedStoryOf(parts, location, problems);
  const json = loaded === undefined ? undefined : jsonValue(loaded.args);
  const args = isRecord(json) ? json : {};
  const { docs, problem } = docsOf(parts.docs);
  if (problem !== undefined) problems.push(problem);
  const declaration = loaded === undefined ? undefined : declarationOf(loaded, docs, parts);
  const setArgs =
    declaration === undefined || parts.setArgs === undefined
      ? undefined
      : checkedSetArgs(parts.setArgs, declaration, parts.addressTexts);
  for (const { name, reason } of setArgs?.dropped ?? []) {
    problems.push(`The value of "${name}" was left out: ${DROPPED_REASONS[reason]}`);
  }
  const story = withSetArgLinks(listedStory, setArgs, pages, view);
  const controls = declaration === undefined ? [] : storyControlsOf(declaration);
  problems.push(...customControlProblems(controls, parts.customControls));
  return {
    schema: 1,
    requiredProps: (docs?.props ?? []).filter((prop) => prop.isRequired).map((prop) => prop.name),
    story,
    component: {
      id: component.id,
      title: component.title,
      source: component.source,
      file: component.file,
      files: component.files,
      ...(component.design === undefined ? {} : { design: component.design }),
      ...(component.usedIn === undefined ? {} : { usedIn: component.usedIn })
    },
    ...agentDesign(location.story, pages, view),
    docs,
    args,
    controls,
    ...(setArgs === undefined ? {} : { setArgs: { accepted: setArgs.accepted, dropped: setArgs.dropped } }),
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
 * Whether a value is the errors document, as a client receives it over HTTP.
 *
 * @param value - the answer's body.
 */
export const isErrorsDocument = (value: unknown): value is ErrorsDocument =>
  typeof value === "object" &&
  value !== null &&
  "schema" in value &&
  value.schema === 1 &&
  "errors" in value &&
  Array.isArray(value.errors) &&
  value.errors.every(
    (error: unknown) =>
      isLiveErrorReport(error) &&
      "n" in error &&
      typeof error.n === "number" &&
      "at" in error &&
      typeof error.at === "string"
  ) &&
  "last" in value &&
  typeof value.last === "number" &&
  "problems" in value &&
  Array.isArray(value.problems);

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
  isRecord(value) &&
  value["schema"] === 1 &&
  Array.isArray(value["requiredProps"]) &&
  isRecord(value["story"]) &&
  Array.isArray(value["problems"]);

/**
 * Whether a value is the tokens document, as a client receives it over HTTP.
 *
 * @param value - the answer's body.
 */
export const isTokensDocument = (value: unknown): value is TokensDocument =>
  isRecord(value) &&
  value["schema"] === 1 &&
  Array.isArray(value["tokens"]) &&
  Array.isArray(value["problems"]) &&
  Array.isArray(value["clashes"]);

/**
 * Whether a value is one token's document, as a client receives it over HTTP.
 *
 * @param value - the answer's body.
 */
export const isTokenDocument = (value: unknown): value is TokenDocument =>
  isRecord(value) &&
  value["schema"] === 1 &&
  isRecord(value["token"]) &&
  Array.isArray(value["problems"]) &&
  Array.isArray(value["clashes"]);

/**
 * Whether a value is the nearest tokens' document, as a client receives it over HTTP.
 *
 * @param value - the answer's body.
 */
export const isNearestTokensDocument = (value: unknown): value is NearestTokensDocument =>
  isRecord(value) &&
  value["schema"] === 1 &&
  Array.isArray(value["matches"]) &&
  Array.isArray(value["problems"]);

/**
 * Whether a value is an intent search's document, as a client receives it over HTTP.
 *
 * @param value - the answer's body.
 */
export const isFoundComponentsDocument = (value: unknown): value is FoundComponentsDocument =>
  isRecord(value) &&
  value["schema"] === 1 &&
  typeof value["query"] === "string" &&
  Array.isArray(value["components"]);

/**
 * Whether a value is a search's document, as a client receives it over HTTP.
 *
 * @param value - the answer's body.
 */
export const isSearchDocument = (value: unknown): value is SearchDocument =>
  isRecord(value) &&
  value["schema"] === 1 &&
  typeof value["query"] === "string" &&
  typeof value["total"] === "number" &&
  Array.isArray(value["results"]) &&
  Array.isArray(value["problems"]);

/**
 * Whether a value is the changed stories' document, as a client receives it over HTTP.
 *
 * @param value - the answer's body.
 */
export const isChangedStoriesDocument = (value: unknown): value is ChangedStoriesDocument =>
  isRecord(value) &&
  value["schema"] === 1 &&
  Array.isArray(value["stories"]) &&
  Array.isArray(value["files"]) &&
  Array.isArray(value["uiFiles"]) &&
  Array.isArray(value["outside"]);

/**
 * Whether a value is the answer on what agents cannot see, as a client receives it over HTTP.
 *
 * @param value - the answer's body.
 */
export const isVisibilityDocument = (value: unknown): value is VisibilityDocument =>
  isRecord(value) &&
  value["schema"] === 1 &&
  Array.isArray(value["packages"]) &&
  Array.isArray(value["unseen"]) &&
  Array.isArray(value["skipped"]);

/**
 * Whether a value is the code check's document, as a client receives it over HTTP.
 *
 * @param value - the answer's body.
 */
export const isCheckedCodeDocument = (value: unknown): value is CheckedCodeDocument =>
  isRecord(value) &&
  value["schema"] === 1 &&
  typeof value["since"] === "string" &&
  Array.isArray(value["problems"]);

/**
 * Whether a value is the docs pages' document, as a client receives it over HTTP.
 *
 * @param value - the answer's body.
 */
export const isPagesDocument = (value: unknown): value is PagesDocument =>
  isRecord(value) &&
  value["schema"] === 1 &&
  Array.isArray(value["pages"]) &&
  Array.isArray(value["problems"]);

/**
 * Whether a value is one docs page's document, as a client receives it over HTTP.
 *
 * @param value - the answer's body.
 */
export const isPageDocument = (value: unknown): value is PageDocument =>
  isRecord(value) &&
  value["schema"] === 1 &&
  isRecord(value["page"]) &&
  typeof value["text"] === "string" &&
  Array.isArray(value["problems"]);
