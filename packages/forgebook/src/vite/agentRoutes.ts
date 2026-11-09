/**
 * The dev server's answers to tools and agents, under `/__forgebook/api/`: `stories` (every story) and `story?id=…`
 * (one in detail), `pages` and `page?id=…` (the docs pages), `search?query=…` (everything, by its text), each with an
 * optional `view` (the view's query, `theme=dark&lang=it`) the links open in; and `preview?id=…`, the page that shows a
 * story inside a client that renders apps, the one answer that is not JSON.
 *
 * @remarks
 * The server loads the sources with the same imports the pages use (`AGENT_SOURCES_FILE`), so a tool sees what the
 * shell shows. A story module that fails on Node (it reads `window` while it loads) gives its story a problem in the
 * answer instead of an error. A preview is written for a browser, and only its args and parameters are read here: it
 * loads with what it imports that needs a browser left as placeholders (`previewRunner.ts`), and one that still fails is
 * left out of the answers and named among their problems, so it costs a tool neither the catalogue nor answers changed
 * without a word. Served by the dev server only, where
 * Vite listens (localhost by default); a build has none of it.
 *
 * @module
 */
import type { IncomingMessage, ServerResponse } from "node:http";

import type { StorySource } from "@forgebook/story-format/source";
import { createIdResolver, type ViteDevServer } from "vite";

import type { ControlArgType, ValueSchema } from "../argControl.ts";
import { offersUsedIn, readsComponentDocs } from "../catalogue.ts";
import { isComponentDocs } from "../componentDocs.ts";
import type { ControlCoders } from "../controlCode.ts";
import type { StoryCodeWriter } from "../frame/renderer.ts";
import { type LoadedPreview, mergedPreviews, NO_PREVIEW, readPreview } from "../frame/storyModule.ts";
import type { FramesPlacement, PageOrigins } from "../frameOrigins.ts";
import type { LiveErrors } from "../liveErrors.ts";
import type { JsonValue } from "../plugin.ts";
import { sourceFiles } from "../sourceFiles.ts";
import type { CustomControlsRead } from "../storyControls.ts";
import { catalogueStatuses } from "../storyStatuses.ts";
import { findStory, type StoryTree, storyTree } from "../storyTree.ts";
import { sourceUsage, type UsageIndex } from "../usedIn.ts";
import { isValueSchema } from "../valueSchema.ts";
import { frameAddressOf } from "../viewState.ts";
import type { ErrorsDocument, StoryDocument } from "./agent.types.ts";
import {
  type CataloguePages,
  customControlNames,
  type LoadedStoryParts,
  storiesDocument,
  storyDocument
} from "./agentApi.ts";
import { agentIndexAnswer } from "./agentIndexRoute.ts";
import { storiesWithStatus, storyWithStatus } from "./agentStatuses.ts";
import { type AgentCodeParts, withStoryCode } from "./agentStoryCode.ts";
import { changedAnswer } from "./changedRoute.ts";
import type { ResolvedConfig } from "./configFile.ts";
import { pageAnswer, pagesAnswer } from "./docPagesRoute.ts";
import { emptyStoryGlobs, emptyStoryGlobsMessage } from "./emptyStoryGlobs.ts";
import { findAnswer } from "./findRoute.ts";
import { framesOriginOf } from "./framesConfig.ts";
import { hostOf } from "./framesServer.ts";
import { hiddenStoryFolders, hiddenStoryFoldersMessage } from "./hiddenStoryFiles.ts";
import { AGENT_SOURCES_FILE, pageModulePath } from "./pages.ts";
import { PREVIEW_ROUTE } from "./previewRoute.ts";
import { loadPreview } from "./previewRunner.ts";
import { searchAnswer } from "./searchRoute.ts";
import { catalogueTokens, STORYLESS_ROUTES } from "./storylessRoutes.ts";

/** The path the answers live under. */
export const AGENT_API = "/__forgebook/api/";

/**
 * The pages under `AGENT_API` another origin's page may frame: a client's inline preview. They show a story and act on
 * nothing, so the catalogue's guard lets another origin open them, as it does the catalogue's page.
 */
export const FRAMED_AGENT_PAGES: ReadonlySet<string> = new Set([`${AGENT_API}${PREVIEW_ROUTE}`]);

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
  /** Why a preview was left out: it could not load on the server. */
  readonly problems: readonly string[];
};

/** A preview, read from what loads it, or why it cannot load on the server. */
const loadedPreview = async (load: () => Promise<unknown>): Promise<LoadedPreview | string> => {
  try {
    return readPreview(await load());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `a preview did not load on the server, so its args and parameters are left out of these answers: ${message}`;
  }
};

/**
 * The agent module read with the catalogue's previews, or why it is not what the plugin generates.
 *
 * @param module - the module of `AGENT_SOURCES_FILE`, as the server loaded it.
 * @param previews - what loads each preview, in the configuration's order.
 */
export const agentModuleOf = async (
  module: unknown,
  previews: readonly (() => Promise<unknown>)[]
): Promise<AgentModule> => {
  if (!isRecord(module) || !Array.isArray(module["sources"]))
    throw new Error("The catalogue's sources did not load");
  const sources = module["sources"].filter(isStorySource);
  const loaded = await Promise.all(previews.map(loadedPreview));
  return {
    sources,
    preview: mergedPreviews(loaded.map((each) => (typeof each === "string" ? NO_PREVIEW : each))),
    problems: loaded.filter((each) => typeof each === "string")
  };
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

/** What an answer asks of the dev server. */
export type AgentServer = {
  /** Loads a module on the server. */
  readonly load: (id: string) => Promise<unknown>;
  /** Loads a preview on the server, with what only a browser can load left as placeholders (`previewRunner.ts`). */
  readonly loadPreview: (file: string) => Promise<unknown>;
  /** The file a source's module specifier leads to, as the pages' imports find it; none when nothing does. */
  readonly resolveSource: (specifier: string) => Promise<string | undefined>;
};

/**
 * What the answers ask of a dev server.
 *
 * @param server - the dev server.
 * @param config - the catalogue's configuration, whose generated module the sources are imported from.
 */
export const agentServer = (server: ViteDevServer, config: ResolvedConfig): AgentServer => {
  // Vite's resolver, not Node's: a catalogue's aliases and a package's export conditions lead to the same file; `scan`
  // keeps it on the package's own file and away from the optimizer, which would answer with a prebundle
  const resolveId = createIdResolver(server.config, { scan: true });
  return {
    load: (id: string): Promise<unknown> => server.ssrLoadModule(id),
    loadPreview: (file: string): Promise<unknown> => loadPreview(server.environments.ssr, file),
    resolveSource: (specifier: string): Promise<string | undefined> =>
      resolveId(server.environments.client, specifier, pageModulePath(config.dir, AGENT_SOURCES_FILE))
  };
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
  /** What the answers ask of the dev server; none reads no custom control. */
  readonly server?: AgentServer;
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
export const storiesAnswer = async (context: RouteContext): Promise<AgentAnswer> => {
  const { config, params, tree, pages, view, loaded } = context;
  const usage =
    offersUsedIn(config.lists) && params.get("usedIn") === "true"
      ? await usageBySource(loaded.sources)
      : undefined;
  // read for each answer: the file an agent has just written ends the problem
  const globs = emptyStoryGlobs(config);
  const hidden = hiddenStoryFolders(config);
  const said = [
    ...(globs.length === 0 ? [] : [emptyStoryGlobsMessage(globs)]),
    ...(hidden.length === 0 ? [] : [hiddenStoryFoldersMessage(hidden)])
  ];
  const listed = said.length === 0 ? tree : { ...tree, problems: [...said, ...tree.problems] };
  const statuses = catalogueStatuses(config.lists.statuses);
  return {
    status: 200,
    body: storiesWithStatus(storiesDocument(config.title, listed, pages, view, usage), listed, statuses)
  };
};

/**
 * One story in detail, its component's "Used in" when offered.
 *
 * @param context - what the routes read.
 */
export const storyAnswer = async (context: RouteContext): Promise<AgentAnswer> => {
  const { config, params, tree, pages, view, loaded } = context;
  const id = params.get("id") ?? "";
  const location = findStory(tree, id);
  const source = loaded.sources.find((each) => each.id === location?.source.id);
  if (location === undefined || source === undefined)
    return { status: 404, body: { error: `No story "${id}"` } };
  const files = sourceFiles(source);
  // the story's own file: its module, and the docs of the component its meta names, which its args are for
  const file = location.story.file;
  const storyModule = await settled(files.stories[file]);
  const docs = await settled(files.docs[file]);
  const parts: LoadedStoryParts = {
    module: storyModule,
    docs,
    preview: loaded.preview,
    namedValues: source.namedValues,
    setArgs: params.get("args") ?? undefined,
    customControls:
      context.server === undefined
        ? undefined
        : await customControlsRead(
            [...customControlNames(storyModule, location), ...typedControlNames(docs)],
            config,
            context.server
          ),
    addressTexts: config.framework.addressTexts
  };
  const code: AgentCodeParts | undefined =
    context.server === undefined
      ? undefined
      : {
          code: await settled(files.code[file]),
          writer: await codeWriterOf(config, context.server),
          namedValues: source.namedValues,
          coders: parts.customControls?.coders ?? {}
        };
  const index = offersUsedIn(config.lists) ? await sourceUsage(source) : undefined;
  // a usage that cannot be read leaves "Used in" out, never the story
  const usage = index === undefined || typeof index === "string" ? undefined : { tree, index };
  const module = "value" in storyModule ? storyModule.value : undefined;
  const document = storyWithStatus(
    withStoryCode(storyDocument(location, parts, pages, view, usage), code, {
      location,
      module,
      preview: loaded.preview
    }),
    location.component,
    catalogueStatuses(config.lists.statuses)
  );
  // an agent must tell docs turned off from a story file that names no component
  const body: StoryDocument = readsComponentDocs(config.lists)
    ? document
    : { ...document, componentDocs: "off" };
  return { status: 200, body };
};

/** Whether a module's `codeOf` is a code writer: a function, as every framework's code module exports it. */
const isCodeWriter = (value: unknown): value is StoryCodeWriter => typeof value === "function";

/**
 * The framework's code writer, loaded on the server as the shell imports it; none when it does not load there.
 *
 * @param config - the catalogue's configuration.
 * @param server - what the answers ask of the dev server.
 */
const codeWriterOf = async (
  config: ResolvedConfig,
  server: AgentServer
): Promise<StoryCodeWriter | undefined> => {
  try {
    const id = await server.resolveSource(config.framework.pages.code);
    // loading a module that does not resolve would only have Vite log its failure
    const loaded = id === undefined ? undefined : await server.load(id);
    const writer =
      typeof loaded === "object" && loaded !== null && "codeOf" in loaded ? loaded.codeOf : undefined;
    return isCodeWriter(writer) ? writer : undefined;
  } catch {
    // a writer that touches the page as it loads has no code to give an agent; the story's answer stands without it
    return undefined;
  }
};

/**
 * The controls the catalogue gives a story's props by type or name, as its component's docs say: their modules load for
 * the story's document too.
 *
 * @param docs - the docs, as the dev server loaded them.
 */
const typedControlNames = (
  docs: { readonly value: unknown } | { readonly error: string }
): readonly string[] =>
  "value" in docs && isComponentDocs(docs.value)
    ? docs.value.props.flatMap((prop) => prop.customControl ?? [])
    : [];

/** How long a control's module may take to load for an answer: one that hangs must not hold every answer with it. */
const CONTROL_LOAD_MS = 5000;

/** A control's module as the server reads it: its schema and what writes its values as code; a text says why not. */
const controlReadOf = async (
  module: string,
  server: AgentServer
): Promise<{ readonly schema: ValueSchema; readonly toCode: ControlCoders[string] } | string> => {
  try {
    const id = await server.resolveSource(module);
    const timeout = new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error(`no answer in ${CONTROL_LOAD_MS} ms`)), CONTROL_LOAD_MS).unref();
    });
    const loaded = await Promise.race([server.load(id ?? module), timeout]);
    const isModule = typeof loaded === "object" && loaded !== null;
    const schema = isModule && "schema" in loaded ? loaded.schema : undefined;
    const toCode = isModule && "toCode" in loaded ? loaded.toCode : undefined;
    if (!isValueSchema(schema)) return "its module exports no schema Forgebook can read";
    return {
      schema,
      toCode:
        typeof toCode === "function"
          ? (value: JsonValue, argType: ControlArgType): string | undefined => {
              const code: unknown = toCode(value, argType);
              return typeof code === "string" ? code : undefined;
            }
          : undefined
    };
  } catch (error) {
    return `its module cannot be read on the server: ${error instanceof Error ? error.message : String(error)}`;
  }
};

/**
 * The custom controls a story names, as an agent reads them: only those, each module loaded on the server for its schema.
 * A module that cannot load there (it touches the page as it is imported) has no schema to say, and no value of it can be
 * checked. Its import runs on the dev server, as a story file's does.
 *
 * @param names - the controls the story names.
 * @param config - the catalogue's configuration.
 * @param server - what the answers ask of the dev server.
 */
const customControlsRead = async (
  names: readonly string[],
  config: ResolvedConfig,
  server: AgentServer
): Promise<CustomControlsRead> => {
  const known = names.flatMap((name) => {
    const control = Object.hasOwn(config.argControls, name) ? config.argControls[name] : undefined;
    return control === undefined ? [] : [[name, control.module] as const];
  });
  const read = await Promise.all(
    known.map(async ([name, module]) => [name, await controlReadOf(module, server)] as const)
  );
  return {
    schemas: Object.fromEntries(
      read.flatMap(([name, each]) => (typeof each === "string" ? [] : [[name, each.schema]]))
    ),
    coders: Object.fromEntries(
      read.flatMap(([name, each]) => (typeof each === "string" ? [] : [[name, each.toCode]]))
    ),
    problems: Object.fromEntries(
      read.flatMap(([name, each]) => (typeof each === "string" ? [[name, each]] : []))
    )
  };
};

/**
 * Answers one of the API's paths.
 *
 * @param server - what the answers ask of the dev server.
 * @param config - the catalogue's configuration.
 * @param route - the path under `AGENT_API` (`stories`, `story`).
 * @param params - the query: `id` for a story, `view` for the links, `args` for the values to set, `category`, `name`, `value` and `type` for the
 *   tokens, `query` and `limit` for a search, `usedIn=true` for the list's "Used in" (a
 *   story's comes with it when the catalogue offers it).
 * @param origins - where the catalogue is served (`http://localhost:5173`) and where its frames are, for the links.
 * @param live - the errors the open frames reported, on a dev server a browser uses; none for a server of the
 *   command's own, which no frame reports to.
 */
export const agentAnswer = async (
  server: AgentServer,
  config: ResolvedConfig,
  route: string,
  params: URLSearchParams,
  origins: PageOrigins,
  live?: LiveErrors
): Promise<AgentAnswer> => {
  try {
    const answerAlone = STORYLESS_ROUTES[route];
    if (answerAlone !== undefined) return await answerAlone(config, params, server.resolveSource);
    const loaded = await agentModuleOf(
      await server.load(pageModulePath(config.dir, AGENT_SOURCES_FILE)),
      config.previews.map((file) => (): Promise<unknown> => server.loadPreview(file))
    );
    const tree = storyTree(loaded.sources);
    const context: RouteContext = {
      loaded,
      tree: { ...tree, problems: [...loaded.problems, ...tree.problems] },
      config,
      params,
      pages: { page: `${origins.catalogue}/`, frame: `${origins.frames}/frame.html` },
      view: params.get("view") ?? "",
      server
    };
    if (route === "errors") return errorsAnswer(context, live);
    if (route === "stories") return await storiesAnswer(context);
    if (route === "story") return await storyAnswer(context);
    if (route === "find") return await findAnswer(context);
    if (route === "search") return await searchAnswer(context);
    if (route === "pages") return await pagesAnswer(context);
    if (route === "page") return await pageAnswer(context);
    if (route === "changed") return await changedAnswer(context, server.resolveSource);
    // loaded when asked: it reads syntax with TypeScript, which a dev server's thread must not pay for at start
    if (route === "visibility") return await (await import("./visibilityRoute.ts")).visibilityAnswer(context);
    if (route === "agent-index")
      return await agentIndexAnswer(context, await catalogueTokens(config, server.resolveSource));
    return { status: 404, body: { error: `No answer at ${AGENT_API}${route}` } };
  } catch (error) {
    return { status: 500, body: { error: error instanceof Error ? error.message : String(error) } };
  }
};

/**
 * Answers a story's preview page. Its code is read here, on the first request for one: a dev server no client asks for a
 * preview never loads it.
 *
 * @param url - the request's address: `id` and `view` in its query.
 * @param framesOrigin - the frames' origin, where the page loads the story's frame.
 * @param response - the answer.
 */
const answerPreview = async (url: URL, framesOrigin: string, response: ServerResponse): Promise<void> => {
  const { previewRelayPage } = await import("./previewPages.ts");
  const id = url.searchParams.get("id") ?? "";
  const frame = frameAddressOf(`${framesOrigin}/frame.html`, id, url.searchParams.get("view") ?? "");
  response.setHeader("Content-Type", "text/html");
  response.setHeader("Cache-Control", "no-store");
  response.end(previewRelayPage(frame, id));
};

/**
 * The middleware that answers under `AGENT_API`, for a catalogue's dev server.
 *
 * @param server - the dev server, which loads the modules.
 * @param config - the catalogue's configuration.
 * @param live - the errors the open frames report.
 * @param placement - where the frames run, for the links to them.
 * @returns a Connect middleware: it answers its own paths and passes every other request on.
 */
export const agentMiddleware =
  (
    server: ViteDevServer,
    config: ResolvedConfig,
    live: LiveErrors,
    placement: () => Promise<FramesPlacement>
  ) =>
  (request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void): void => {
    const scheme = server.config.server.https === undefined ? "http:" : "https:";
    const url = new URL(request.url ?? "/", `${scheme}//${hostOf(request) ?? "localhost"}`);
    if (!url.pathname.startsWith(AGENT_API)) {
      next();
      return;
    }
    const route = url.pathname.slice(AGENT_API.length);
    const origins = placement().then(
      (frames: FramesPlacement): PageOrigins => ({
        catalogue: url.origin,
        frames: framesOriginOf(frames, url.href) ?? url.origin
      })
    );
    if (route === PREVIEW_ROUTE) {
      void origins.then((each) => answerPreview(url, each.frames, response)).catch(next);
      return;
    }
    void origins
      .then((each) => agentAnswer(agentServer(server, config), config, route, url.searchParams, each, live))
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
