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

/** Writes a JSON answer. */
const answer = (response: ServerResponse, status: number, body: unknown): void => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(`${JSON.stringify(body)}\n`);
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
    const view = url.searchParams.get("view") ?? "";
    const pages: CataloguePages = { page: `${url.origin}/`, frame: `${url.origin}/frame.html` };
    const reply = async (): Promise<void> => {
      const loaded = agentModuleOf(await server.ssrLoadModule(join(config.dir, AGENT_SOURCES_FILE)));
      const tree = storyTree(loaded.sources);
      if (route === "stories") {
        answer(response, 200, storiesDocument(config.title, tree, pages, view));
        return;
      }
      if (route === "story") {
        const id = url.searchParams.get("id") ?? "";
        const location = findStory(tree, id);
        const source = loaded.sources.find((each) => each.id === location?.source.id);
        if (location === undefined || source === undefined) {
          answer(response, 404, { error: `No story "${id}"` });
          return;
        }
        const files = sourceFiles(source);
        const file = location.component.file;
        const parts: LoadedStoryParts = {
          module: await settled(files.stories[file]),
          docs: await settled(files.docs[file]),
          preview: loaded.preview
        };
        answer(response, 200, storyDocument(location, parts, pages, view));
        return;
      }
      answer(response, 404, { error: `No answer at ${url.pathname}` });
    };
    reply().catch((error: unknown) => {
      answer(response, 500, { error: error instanceof Error ? error.message : String(error) });
    });
  };
