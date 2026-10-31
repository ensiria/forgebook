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

import { type LoadedPreview, mergedPreviews, readPreview } from "../frame/storyModule.ts";
import { sourceFiles } from "../sourceFiles.ts";
import { findStory, storyTree } from "../storyTree.ts";
import { sourceUsage, type UsageIndex } from "../usedIn.ts";
import { type CataloguePages, type LoadedStoryParts, storiesDocument, storyDocument } from "./agentApi.ts";
import type { ResolvedConfig } from "./configFile.ts";
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
 * Answers one of the API's paths.
 *
 * @param load - loads a module on the server (the dev server's `ssrLoadModule`).
 * @param config - the catalogue's configuration.
 * @param route - the path under `AGENT_API` (`stories`, `story`).
 * @param params - the query: `id` for a story, `view` for the links, `usedIn=true` for the list's "Used in" (a
 *   story's comes with it when the catalogue offers it).
 * @param origin - where the catalogue is served (`http://localhost:5173`), for the links.
 */
export const agentAnswer = async (
  load: (id: string) => Promise<unknown>,
  config: ResolvedConfig,
  route: string,
  params: URLSearchParams,
  origin: string
): Promise<AgentAnswer> => {
  const view = params.get("view") ?? "";
  const pages: CataloguePages = { page: `${origin}/`, frame: `${origin}/frame.html` };
  try {
    const loaded = agentModuleOf(await load(join(config.dir, AGENT_SOURCES_FILE)));
    const tree = storyTree(loaded.sources);
    const isUsedIn = config.lists.usedIn !== false;
    if (route === "stories") {
      const usage =
        isUsedIn && params.get("usedIn") === "true" ? await usageBySource(loaded.sources) : undefined;
      return { status: 200, body: storiesDocument(config.title, tree, pages, view, usage) };
    }
    if (route !== "story") return { status: 404, body: { error: `No answer at ${AGENT_API}${route}` } };
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
    const index = isUsedIn ? await sourceUsage(source) : undefined;
    // a usage that cannot be read leaves "Used in" out, never the story
    const usage = index === undefined || typeof index === "string" ? undefined : { tree, index };
    return { status: 200, body: storyDocument(location, parts, pages, view, usage) };
  } catch (error) {
    return { status: 500, body: { error: error instanceof Error ? error.message : String(error) } };
  }
};

/**
 * The middleware that answers under `AGENT_API`, for a catalogue's dev server.
 *
 * @param server - the dev server, which loads the modules.
 * @param config - the catalogue's configuration.
 * @returns a Connect middleware: it answers its own paths and passes every other request on.
 */
export const agentMiddleware =
  (server: ViteDevServer, config: ResolvedConfig) =>
  (request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void): void => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (!url.pathname.startsWith(AGENT_API)) {
      next();
      return;
    }
    const route = url.pathname.slice(AGENT_API.length);
    void agentAnswer((id) => server.ssrLoadModule(id), config, route, url.searchParams, url.origin).then(
      ({ status, body }) => {
        response.statusCode = status;
        response.setHeader("Content-Type", "application/json");
        response.setHeader(ROOT_HEADER, config.dir);
        response.end(`${JSON.stringify(body)}\n`);
      }
    );
  };
