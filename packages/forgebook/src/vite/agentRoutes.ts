/**
 * The dev server's answers to tools and agents, under `/__forgebook/api/`: `stories` (every story) and `story?id=…`
 * (one in detail), each with an optional `view` (the view's query, `theme=dark&lang=it`) the links open in.
 *
 * @remarks
 * The server loads the sources and the previews with the same imports the pages use (`AGENT_SOURCES_FILE`), so a tool
 * sees what the shell shows. A story module that fails on Node (it reads `window` while it loads) gives its story a
 * problem in the answer instead of an error. Served by the dev server only, where Vite listens (localhost by default);
 * a build has none of it.
 *
 * @module
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";

import type { StorySource } from "@forgebook/story-format/source";
import type { ViteDevServer } from "vite";

import { isComponentDocs, type UsageGuidance } from "../componentDocs.ts";
import { type LoadedPreview, mergedPreviews, readPreview } from "../frame/storyModule.ts";
import type { LiveErrors } from "../liveErrors.ts";
import { sourceFiles } from "../sourceFiles.ts";
import {
  componentId,
  findStory,
  type StoryTree,
  storyTree,
  type TreeComponent,
  type TreeSource
} from "../storyTree.ts";
import { sourceUsage, type UsageIndex } from "../usedIn.ts";
import type { AgentFoundComponent, ErrorsDocument, FoundComponentsDocument } from "./agent.types.ts";
import {
  type CataloguePages,
  type LoadedStoryParts,
  storiesDocument,
  storyDocument,
  storyLinks
} from "./agentApi.ts";
import type { ResolvedConfig } from "./configFile.ts";
import { findComponents } from "./findComponent.ts";
import { AGENT_SOURCES_FILE } from "./pages.ts";

/** The path the answers live under. */
export const AGENT_API = "/__forgebook/api/";

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a value is a source, as far as the answers read one: its id, name and story files. */
const isStorySource = (value: unknown): value is StorySource =>
  isRecord(value) &&
  typeof value["id"] === "string" &&
  typeof value["name"] === "string" &&
  Array.isArray(value["files"]);

/** What the agent module gives: the sources and the previews merged. */
type AgentModule = {
  /** The catalogue's sources, in its order. */
  readonly sources: readonly StorySource[];
  /** Its previews merged. */
  readonly preview: LoadedPreview;
};

/** The agent module read, or why it is not what the plugin generates. */
const agentModuleOf = (module: unknown): AgentModule => {
  if (!isRecord(module) || !Array.isArray(module["sources"]) || !Array.isArray(module["previews"]))
    throw new Error("The catalogue's sources did not load");
  const sources = module["sources"].filter(isStorySource);
  return { sources, preview: mergedPreviews(module["previews"].map(readPreview)) };
};

/** A loader's value, or why it failed. */
const settled = async (load: (() => Promise<unknown>) | undefined): Promise<LoadedStoryParts["docs"]> => {
  if (load === undefined) return { value: { name: null } };
  try {
    return { value: await load() };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
};

/**
 * Each source's "Used in", by source id; a source whose usage cannot be read is left out.
 *
 * @param sources - the sources.
 */
const usageBySource = async (sources: readonly StorySource[]): Promise<Map<string, UsageIndex>> => {
  const answers = await Promise.all(
    sources.map(
      async (source): Promise<[string, UsageIndex | string]> => [source.id, await sourceUsage(source)]
    )
  );
  return new Map(
    answers.flatMap(([id, index]): [string, UsageIndex][] => (typeof index === "string" ? [] : [[id, index]]))
  );
};

/** An answer: its HTTP status and its JSON body. */
export type AgentAnswer = {
  /** 200, 404 for a story or a path that does not exist, 500 when the sources fail to load. */
  readonly status: number;
  /** The document, or `{ error }`. */
  readonly body: unknown;
};

/** The header that names the catalogue's folder, so a client knows the server it found serves its catalogue. */
export const ROOT_HEADER = "forgebook-root";

/**
 * The root header's value for a catalogue's folder: encoded, since a header holds Latin-1 only and a folder's name may
 * hold any character (`Progetti è`, `プロジェクト`).
 *
 * @param dir - the catalogue's folder.
 */
export const rootHeaderValue = (dir: string): string => encodeURIComponent(dir);

/** What every route reads: the catalogue's sources and tree, its configuration, the query and the links' pages. */
type RouteContext = {
  /** The sources and the preview, as the dev server loaded them. */
  readonly loaded: AgentModule;
  /** The sources' story tree. */
  readonly tree: StoryTree;
  /** The catalogue's configuration. */
  readonly config: ResolvedConfig;
  /** The query. */
  readonly params: URLSearchParams;
  /** Where the catalogue is served, for the links. */
  readonly pages: CataloguePages;
  /** The view the links open in; empty for the default view. */
  readonly view: string;
};

/**
 * The errors the open frames reported after the number asked for, and the index's problems.
 *
 * @param context - what the routes read.
 * @param live - the errors, when frames report to this server.
 */
const errorsAnswer = (context: RouteContext, live: LiveErrors | undefined): AgentAnswer => {
  const since = Number(context.params.get("since") ?? "0");
  const body: ErrorsDocument = {
    schema: 1,
    errors: live?.since(Number.isFinite(since) ? since : 0) ?? [],
    last: live?.last() ?? 0,
    problems: context.tree.problems
  };
  return { status: 200, body };
};

/**
 * The stories, with each component's "Used in" when asked for and offered.
 *
 * @param context - what the routes read.
 */
const storiesAnswer = async (context: RouteContext): Promise<AgentAnswer> => {
  const { config, params, tree, pages, view, loaded } = context;
  const usage =
    config.lists.usedIn !== false && params.get("usedIn") === "true"
      ? await usageBySource(loaded.sources)
      : undefined;
  return { status: 200, body: storiesDocument(config.title, tree, pages, view, usage) };
};

/**
 * One story in detail, its component's "Used in" when offered.
 *
 * @param context - what the routes read.
 */
const storyAnswer = async (context: RouteContext): Promise<AgentAnswer> => {
  const { config, params, tree, pages, view, loaded } = context;
  const id = params.get("id") ?? "";
  const location = findStory(tree, id);
  const source = loaded.sources.find((each) => each.id === location?.source.id);
  if (location === undefined || source === undefined)
    return { status: 404, body: { error: `No story "${id}"` } };
  const files = sourceFiles(source);
  const file = location.component.file;
  const parts: LoadedStoryParts = {
    module: await settled(files.stories[file]),
    docs: await settled(files.docs[file]),
    preview: loaded.preview
  };
  const index = config.lists.usedIn === false ? undefined : await sourceUsage(source);
  // a usage that cannot be read leaves "Used in" out, never the story
  const usage = index === undefined || typeof index === "string" ? undefined : { tree, index };
  return { status: 200, body: storyDocument(location, parts, pages, view, usage) };
};

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

/**
 * The components a query describes, with their guidance and the links of their first story.
 *
 * @param context - what the routes read.
 */
const findAnswer = async ({ tree, params, pages, view, loaded }: RouteContext): Promise<AgentAnswer> => {
  const query = params.get("query") ?? "";
  if (query.trim() === "") return { status: 400, body: { error: "No words to look for" } };
  const located = treeComponents(tree);
  const findable = located.map(({ source, component }) => ({
    id: componentId(source.id, component.title),
    title: component.title,
    keywords: component.keywords,
    stories: component.stories.map((story) => `${story.name} ${story.description ?? ""}`)
  }));
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

/**
 * Answers one of the API's paths.
 *
 * @param load - loads a module on the server (the dev server's `ssrLoadModule`).
 * @param config - the catalogue's configuration.
 * @param route - the path under `AGENT_API` (`stories`, `story`).
 * @param params - the query: `id` for a story, `view` for the links, `usedIn=true` for the list's "Used in" (a
 *   story's comes with it when the catalogue offers it).
 * @param origin - where the catalogue is served (`http://localhost:5173`), for the links.
 * @param live - the errors the open frames reported, on a dev server a browser uses; none for a server of the
 *   command's own, which no frame reports to.
 */
export const agentAnswer = async (
  load: (id: string) => Promise<unknown>,
  config: ResolvedConfig,
  route: string,
  params: URLSearchParams,
  origin: string,
  live?: LiveErrors
): Promise<AgentAnswer> => {
  try {
    const loaded = agentModuleOf(await load(join(config.dir, AGENT_SOURCES_FILE)));
    const context: RouteContext = {
      loaded,
      tree: storyTree(loaded.sources),
      config,
      params,
      pages: { page: `${origin}/`, frame: `${origin}/frame.html` },
      view: params.get("view") ?? ""
    };
    if (route === "errors") return errorsAnswer(context, live);
    if (route === "stories") return await storiesAnswer(context);
    if (route === "story") return await storyAnswer(context);
    if (route === "find") return await findAnswer(context);
    return { status: 404, body: { error: `No answer at ${AGENT_API}${route}` } };
  } catch (error) {
    return { status: 500, body: { error: error instanceof Error ? error.message : String(error) } };
  }
};

/**
 * The middleware that answers under `AGENT_API`, for a catalogue's dev server.
 *
 * @param server - the dev server, which loads the modules.
 * @param config - the catalogue's configuration.
 * @param live - the errors the open frames report.
 * @returns a Connect middleware: it answers its own paths and passes every other request on.
 */
export const agentMiddleware =
  (server: ViteDevServer, config: ResolvedConfig, live: LiveErrors) =>
  (request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void): void => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (!url.pathname.startsWith(AGENT_API)) {
      next();
      return;
    }
    const route = url.pathname.slice(AGENT_API.length);
    void agentAnswer((id) => server.ssrLoadModule(id), config, route, url.searchParams, url.origin, live)
      .then(({ status, body }) => {
        response.statusCode = status;
        response.setHeader("Content-Type", "application/json");
        response.setHeader(ROOT_HEADER, rootHeaderValue(config.dir));
        response.end(`${JSON.stringify(body)}\n`);
      })
      .catch((error: unknown) => {
        response.statusCode = 500;
        response.setHeader("Content-Type", "application/json");
        response.end(
          `${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`
        );
      });
  };
