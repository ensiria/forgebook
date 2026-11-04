/**
 * The modules the plugin makes from a file's text: a story file's code (`?forgebook-code`), a component's page
 * (`?forgebook-page`) and a source's Markdown file (`?forgebook-markdown`).
 *
 * @remarks
 * Colouring code loads highlight.js and the TypeScript compiler's scanner, and Markdown its reader: each is imported
 * only when a query needs it, code only when a story has a `render` to colour, and a story file's code is kept on disk
 * between starts (`diskCache.ts`), so a story's page reads it without either on a later start.
 *
 * @module
 */
import { readFileSync } from "node:fs";

import type { StoryMarkdown } from "@forgebook/story-format/source";

import { codeLiteral } from "../codeLiteral.ts";
import type { ComponentFiles } from "./adapter.ts";
import { componentImport } from "./componentImport.ts";
import { type DiskCache, isSettledSince, nowNs, stampPaths } from "./diskCache.ts";
import { moduleSummaryOf } from "./moduleSummary.ts";
import { storyCode } from "./storyCode.ts";
import { CODE_QUERY, MARKDOWN_QUERY, PAGE_QUERY } from "./textQueries.ts";

/** A module the plugin answers. */
type AnsweredModule = { code: string; moduleType: "js" };

/**
 * The module whose default export is a value.
 *
 * @param value - the value, as JSON.
 */
const valueModule = (value: unknown): AnsweredModule => ({
  code: `export default ${codeLiteral(value)};`,
  moduleType: "js"
});

/** A story file's code as the Code tab reads it: each story's `render` text and its coloured HTML, or why it cannot. */
export type KeptCode =
  | { readonly error: string }
  | Readonly<Record<string, { readonly text: string; readonly html: string }>>;

/** Whether what a cache file holds is a story file's code. */
export const isKeptCode = (value: unknown): value is KeptCode =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Each story's `render` text with its coloured HTML.
 *
 * @remarks
 * The colouring loads the TypeScript compiler, tens of megabytes the server then holds for as long as it runs: only a
 * file with a `render` to colour loads it. A file whose stories are all args has none, and its Code tab writes them
 * from the args (the framework's code writer), so a story's page of a library written that way leaves the compiler to
 * the docs worker; a component's page or a Markdown page still loads it, to colour their examples.
 *
 * @param code - each story's `render` text, by export name.
 */
const colouredCode = async (code: Readonly<Record<string, string>>): Promise<KeptCode> => {
  const entries = Object.entries(code);
  if (entries.length === 0) return {};
  const { highlightCode } = await import("./highlightCode.ts");
  return Object.fromEntries(
    entries.map(([name, text]) => [name, { text, html: highlightCode(text, "tsx") }])
  );
};

/**
 * A story file's code as the Code tab reads it, what a `?forgebook-code` import answers: each story's `render` text and
 * its coloured HTML, or `{ error }` for the card.
 *
 * @param storyFile - the story file's absolute path; Vite renews the module when it changes, as the id names it.
 * @param cache - the code kept between starts; none reads the file every time.
 */
export const storyFileCode = async (
  storyFile: string,
  cache: DiskCache<KeptCode> | undefined
): Promise<KeptCode> => {
  const kept = cache?.read(storyFile);
  if (kept !== undefined) return kept;
  const since = nowNs();
  const code = storyCode(storyFile, readFileSync(storyFile, "utf8"));
  const value: KeptCode = typeof code === "string" ? { error: code } : await colouredCode(code);
  // colouring loads the compiler's scanner: kept, a story's page reads its code without it on a later start
  const stamps = stampPaths([storyFile]);
  if (typeof code !== "string" && isSettledSince(stamps, since)) cache?.write(storyFile, value, stamps);
  return value;
};

/**
 * The text a component's file opens with: a framework's own kind of file (`.vue`) by its script.
 *
 * @param file - the file's absolute path.
 * @param componentFiles - the framework's own kind of file; none when it has none.
 */
const scriptOfFile = (file: string, componentFiles: ComponentFiles | undefined): string => {
  const text = readFileSync(file, "utf8");
  return componentFiles !== undefined && file.endsWith(componentFiles.extension)
    ? componentFiles.scriptOf(text)
    : text;
};

/** A component's page as a story file's query answers it. */
export type ComponentPageText = {
  /** Its documentation file as HTML; empty without one. */
  readonly html: string;
  /** The first paragraph of its file's `@module` comment, for the page's lead; empty without one. */
  readonly summary: string;
};

/**
 * A story file's component page, what a `?forgebook-page` import answers: the component's documentation file as HTML
 * (empty without one), and its file's summary, the first paragraph of its `@module` comment, for the page's lead.
 *
 * @remarks
 * The summary is read here, from the component's file alone, rather than with the docs: the docs wait for the
 * package's TypeScript program, and the lead would come seconds after the rest of the page.
 *
 * @param storyFile - the story file's absolute path.
 * @param context - what the plugin gives: the watch (the documentation file, the component's file), how an import of
 * the component resolves, and the framework's own kind of component file.
 */
export const storyFilePage = async (
  storyFile: string,
  context: Pick<TextModuleContext, "watch" | "resolveImport" | "componentFiles">
): Promise<ComponentPageText> => {
  const specifier = componentImport(storyFile, readFileSync(storyFile, "utf8"));
  const componentFile =
    specifier === undefined ? undefined : await context.resolveImport(specifier, storyFile);
  const { componentPage } = await import("./componentPage.ts");
  const page = componentPage(storyFile);
  if (page !== undefined) context.watch(page.file);
  if (componentFile !== undefined) context.watch(componentFile);
  const summary =
    componentFile === undefined ? "" : moduleSummaryOf(scriptOfFile(componentFile, context.componentFiles));
  return { html: page?.html ?? "", summary };
};

/**
 * The module that answers a `?forgebook-markdown` import: a source's Markdown file (its introduction) as HTML.
 *
 * @param file - the Markdown file's absolute path.
 * @param watch - adds a file whose edit renews the module (the Markdown file).
 */
const markdownModule = async (file: string, watch: (file: string) => void): Promise<AnsweredModule> => {
  watch(file);
  const { markdownHtml } = await import("./componentPage.ts");
  const value: StoryMarkdown = { html: markdownHtml(readFileSync(file, "utf8")) };
  return { code: `export default ${codeLiteral(value)};`, moduleType: "js" };
};

/** What the text modules need of the plugin. */
export type TextModuleContext = {
  /** Adds a file whose edit renews the module. */
  readonly watch: (file: string) => void;
  /** Resolves an import of a file as the app resolves it; none when it does not resolve. */
  readonly resolveImport: (specifier: string, importer: string) => Promise<string | undefined>;
  /** The framework's own kind of component file; none when it has none. */
  readonly componentFiles: ComponentFiles | undefined;
  /** The story files' code kept between starts; none reads every time. */
  readonly cache: DiskCache<KeptCode> | undefined;
};

/**
 * The module a query asks for, when the id is one of these.
 *
 * @param id - the module's id.
 * @param context - what the plugin gives.
 */
export const textModule = async (
  id: string,
  context: TextModuleContext
): Promise<AnsweredModule | undefined> => {
  if (id.endsWith(PAGE_QUERY)) {
    return valueModule(await storyFilePage(id.slice(0, -PAGE_QUERY.length), context));
  }
  if (id.endsWith(CODE_QUERY)) {
    return valueModule(await storyFileCode(id.slice(0, -CODE_QUERY.length), context.cache));
  }
  if (id.endsWith(MARKDOWN_QUERY)) return markdownModule(id.slice(0, -MARKDOWN_QUERY.length), context.watch);
  return undefined;
};
