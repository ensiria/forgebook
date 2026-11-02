/**
 * The modules the plugin makes from a file's text: a story file's code (`?forgebook-code`), a component's page
 * (`?forgebook-page`) and a source's Markdown file (`?forgebook-markdown`).
 *
 * @remarks
 * Colouring code takes highlight.js and the TypeScript compiler, the heaviest modules the server's thread could hold,
 * and a story's page asks for its code on every visit. So they load only when there is code to colour and it is not
 * on disk from an earlier start (`diskCache.ts`): most stories have no `render`, and the file changes rarely.
 *
 * @module
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import type { StoryMarkdown } from "@forgebook/story-format/source";

import type { ComponentFiles } from "./adapter.ts";
import { componentImport } from "./componentImport.ts";
import { diskCache } from "./diskCache.ts";
import { moduleSummaryOfText } from "./moduleSummary.ts";
import { pageFileOf } from "./pageFile.ts";
import { storyCode } from "./storyCode.ts";
import { CODE_QUERY, MARKDOWN_QUERY, PAGE_QUERY } from "./textQueries.ts";

/** A story file's code as its module exports it: each story's text and coloured HTML, or why it cannot be read. */
type CodeValue = Readonly<Record<string, unknown>>;

/** Whether what a cache file holds is a story file's code. */
const isCodeValue = (value: unknown): value is CodeValue => typeof value === "object" && value !== null;

/**
 * Each story's `render` text and its coloured HTML, or `{ error }` for the card.
 *
 * @param storyFile - the story file's absolute path.
 */
const coloured = async (storyFile: string): Promise<CodeValue> => {
  const code = storyCode(storyFile, readFileSync(storyFile, "utf8"));
  if (typeof code === "string") return { error: code };
  const entries = Object.entries(code);
  if (entries.length === 0) return {};
  const { highlightCode } = await import("./highlightCode.ts");
  return Object.fromEntries(
    entries.map(([name, text]) => [name, { text, html: highlightCode(text, "tsx") }])
  );
};

/** What made a kept story file's code: this module's own build. */
const CODE_STAMP = String(statSync(new URL(import.meta.url)).mtimeMs);

/**
 * The module that answers a `?forgebook-code` import.
 *
 * @param storyFile - the story file's absolute path; Vite renews the module when it changes, as the id names it.
 * @param cacheFolder - where the code is kept between starts; none reads every time.
 */
const codeModule = async (
  storyFile: string,
  cacheFolder: string | undefined
): Promise<{ code: string; moduleType: "js" }> => {
  const cache =
    cacheFolder === undefined ? undefined : diskCache(join(cacheFolder, "code"), CODE_STAMP, isCodeValue);
  const kept = cache?.read(storyFile);
  const value = kept ?? (await coloured(storyFile));
  if (kept === undefined) cache?.write(storyFile, value, [storyFile]);
  return { code: `export default ${JSON.stringify(value)};`, moduleType: "js" };
};

/**
 * The file of a story file's component, from the meta's import, resolved as the app resolves it.
 *
 * @param storyFile - the story file's absolute path.
 * @param resolve - resolves an import of the story file to its file; none when it does not resolve.
 * @returns the component's file, or none when the meta names no imported component.
 */
const componentFileOf = async (
  storyFile: string,
  resolve: (specifier: string) => Promise<string | undefined>
): Promise<string | undefined> => {
  const specifier = componentImport(storyFile, readFileSync(storyFile, "utf8"));
  return specifier === undefined ? undefined : resolve(specifier);
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

/**
 * The module that answers a `?forgebook-page` import: the component's documentation file as HTML (empty without
 * one), and its file's summary, the first paragraph of its `@module` comment, for the page's lead.
 *
 * @remarks
 * The summary is read here, from the component's file alone, rather than with the docs: the docs wait for the
 * package's TypeScript program, and the lead would come seconds after the rest of the page.
 *
 * @param storyFile - the story file's absolute path.
 * @param componentFile - the component's file, as the story file's import resolves; none when it names none.
 * @param watch - adds a file whose edit renews the module (the documentation file, the component's file).
 * @param componentFiles - the framework's own kind of component file; none when it has none.
 */
const pageModule = async (
  storyFile: string,
  componentFile: string | undefined,
  watch: (file: string) => void,
  componentFiles: ComponentFiles | undefined
): Promise<{ code: string; moduleType: "js" }> => {
  // Markdown and the highlighter load for a component that has a page to read
  const page = existsSync(pageFileOf(storyFile))
    ? (await import("./componentPage.ts")).componentPage(storyFile)
    : undefined;
  if (page !== undefined) watch(page.file);
  if (componentFile !== undefined) watch(componentFile);
  const summary =
    componentFile === undefined ? "" : moduleSummaryOfText(scriptOfFile(componentFile, componentFiles));
  const value = { html: page?.html ?? "", summary };
  return { code: `export default ${JSON.stringify(value)};`, moduleType: "js" };
};

/**
 * The module that answers a `?forgebook-markdown` import: a source's Markdown file (its introduction) as HTML.
 *
 * @param file - the Markdown file's absolute path.
 * @param watch - adds a file whose edit renews the module (the Markdown file).
 */
const markdownModule = async (
  file: string,
  watch: (file: string) => void
): Promise<{ code: string; moduleType: "js" }> => {
  watch(file);
  const { markdownHtml } = await import("./componentPage.ts");
  const value: StoryMarkdown = { html: markdownHtml(readFileSync(file, "utf8")) };
  return { code: `export default ${JSON.stringify(value)};`, moduleType: "js" };
};

/**
 * The module a query asks for, when the id is one.
 *
 * @param id - the module's id.
 * @param watch - adds a file whose edit renews the module.
 * @param resolveImport - resolves an import of a file as the app resolves it.
 * @param cacheFolder - where answers are kept between starts; none reads every time.
 * @param componentFiles - the framework's own kind of component file; none when it has none.
 */
export const textModule = async (
  id: string,
  watch: (file: string) => void,
  resolveImport: (specifier: string, importer: string) => Promise<string | undefined>,
  cacheFolder: string | undefined,
  componentFiles: ComponentFiles | undefined
): Promise<{ code: string; moduleType: "js" } | undefined> => {
  if (id.endsWith(PAGE_QUERY)) {
    const storyFile = id.slice(0, -PAGE_QUERY.length);
    const componentFile = await componentFileOf(storyFile, (specifier: string) =>
      resolveImport(specifier, storyFile)
    );
    return pageModule(storyFile, componentFile, watch, componentFiles);
  }
  if (id.endsWith(CODE_QUERY)) return codeModule(id.slice(0, -CODE_QUERY.length), cacheFolder);
  if (id.endsWith(MARKDOWN_QUERY)) return markdownModule(id.slice(0, -MARKDOWN_QUERY.length), watch);
  return undefined;
};
