/**
 * The dev server's answers to tools and agents, under `/__forgebook/api/`: `stories` (every story) and `story?id=…`
 * (one in detail), `pages` and `page?id=…` (the docs pages), `search?query=…` (everything, by its text), each with an optional `view` (the view's query, `theme=dark&lang=it`) the links open in.
 *
 * @remarks
 * The server loads the sources and the previews with the same imports the pages use (`AGENT_SOURCES_FILE`), so a tool
 * sees what the shell shows. A story module that fails on Node (it reads `window` while it loads) gives its story a
 * problem in the answer instead of an error. Served by the dev server only, where Vite listens (localhost by default);
 * a build has none of it.
 *
 * @module
 */
import { realpath } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, relative } from "node:path";

import type { StorySource } from "@forgebook/story-format/source";
import type { ViteDevServer } from "vite";

import { type LoadedPreview, mergedPreviews, readPreview } from "../frame/storyModule.ts";
import type { LiveErrors } from "../liveErrors.ts";
import { sourceFiles } from "../sourceFiles.ts";
import { componentId, findStory, kebab, type StoryTree, storyTree } from "../storyTree.ts";
import { sourceUsage, type UsageIndex } from "../usedIn.ts";
import type { AgentChangedStory, ChangedStoriesDocument, ErrorsDocument } from "./agent.types.ts";
import {
  type CataloguePages,
  type LoadedStoryParts,
  storiesDocument,
  storyDocument,
  storyLinks
} from "./agentApi.ts";
import type { ResolvedConfig } from "./configFile.ts";
import { pageAnswer, pagesAnswer } from "./docPagesRoute.ts";
import { findAnswer } from "./findRoute.ts";
import { changeBase, changedFiles } from "./gitChange.ts";
import { AGENT_SOURCES_FILE } from "./pages.ts";
import { searchAnswer } from "./searchRoute.ts";
import { STORYLESS_ROUTES } from "./storylessRoutes.ts";
import { affectedStories, type ReachedStory } from "./storyReach.ts";

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
export const settled = async (
  load: (() => Promise<unknown>) | undefined
): Promise<LoadedStoryParts["docs"]> => {
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
export type RouteContext = {
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

/** Whether a value is a list of stories with what they reach. */
const isReach = (value: unknown): value is readonly ReachedStory[] => Array.isArray(value);

/**
 * The stories a change touches, read from the files git names and the import graph "Used in" reads.
 *
 * @param context - what the routes read.
 */
const changedAnswer = async ({
  config,
  loaded,
  tree,
  params,
  pages,
  view
}: RouteContext): Promise<AgentAnswer> => {
  const since = params.get("since") || "HEAD";
  const base = await changeBase(config.dir, since);
  if (base === undefined) return { status: 400, body: { error: `"${since}" names no commit here` } };
  const { root, files } = await changedFiles(config.dir, base);
  const reaches = await Promise.all(
    loaded.sources.flatMap((source) =>
      source.files.map(async (group) => {
        const reach = await group.reach?.();
        return { source: source.id, reach: isReach(reach) ? reach : [] };
      })
    )
  );
  // git names real paths and the graph the catalogue's own, which differ in a folder reached through a link
  const realDir = await realpath(config.dir);
  const changed = files.map((file) => join(config.dir, relative(realDir, join(root, file))));
  const stories = reaches.flatMap(({ source, reach }) =>
    affectedStories(reach, changed).flatMap((story): AgentChangedStory[] => {
      const id = `${componentId(source, story.title)}--${kebab(story.exportName)}`;
      return findStory(tree, id) === undefined
        ? []
        : [{ id, title: story.title, links: storyLinks(pages, id, view) }];
    })
  );
  const body: ChangedStoriesDocument = { schema: 1, since, files, stories, problems: [] };
  return { status: 200, body };
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

/**
 * Answers one of the API's paths.
 *
 * @param load - loads a module on the server (the dev server's `ssrLoadModule`).
 * @param config - the catalogue's configuration.
 * @param route - the path under `AGENT_API` (`stories`, `story`).
 * @param params - the query: `id` for a story, `view` for the links, `category`, `name`, `value` and `type` for the
 *   tokens, `query` and `limit` for a search, `usedIn=true` for the list's "Used in" (a
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
    const answerAlone = STORYLESS_ROUTES[route];
    if (answerAlone !== undefined) return await answerAlone(config, params);
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
    if (route === "search") return await searchAnswer(context);
    if (route === "pages") return pagesAnswer(context);
    if (route === "page") return await pageAnswer(context);
    if (route === "changed") return await changedAnswer(context);
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
