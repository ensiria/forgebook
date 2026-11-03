/**
 * The modules the plugin makes from a file's text: a story file's code (`?forgebook-code`), a component's page
 * (`?forgebook-page`) and a source's Markdown file (`?forgebook-markdown`).
 *
 * @remarks
 * Kept apart from the plugin, which imports this module on the first of these queries: colouring code loads
 * highlight.js and the TypeScript compiler's scanner, and Markdown its reader, which a story's page never uses.
 *
 * @module
 */
import { readFileSync } from "node:fs";

import type { StoryMarkdown } from "@forgebook/story-format/source";

import type { ComponentFiles } from "./adapter.ts";
import { componentImport } from "./componentImport.ts";
import { componentPage, markdownHtml } from "./componentPage.ts";
import { highlightCode } from "./highlightCode.ts";
import { moduleSummaryOf } from "./moduleSummary.ts";
import { storyCode } from "./storyCode.ts";
import { CODE_QUERY, MARKDOWN_QUERY, PAGE_QUERY } from "./textQueries.ts";

/** A module the plugin answers. */
type AnsweredModule = { code: string; moduleType: "js" };

/**
 * The module that answers a `?forgebook-code` import: each story's `render` text and its coloured HTML, or `{ error }`
 * for the card.
 *
 * @param storyFile - the story file's absolute path; Vite renews the module when it changes, as the id names it.
 */
const codeModule = (storyFile: string): AnsweredModule => {
  const code = storyCode(storyFile, readFileSync(storyFile, "utf8"));
  const value =
    typeof code === "string"
      ? { error: code }
      : Object.fromEntries(
          Object.entries(code).map(([name, text]) => [name, { text, html: highlightCode(text, "tsx") }])
        );
  return { code: `export default ${JSON.stringify(value)};`, moduleType: "js" };
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
const pageModule = (
  storyFile: string,
  componentFile: string | undefined,
  watch: (file: string) => void,
  componentFiles: ComponentFiles | undefined
): AnsweredModule => {
  const page = componentPage(storyFile);
  if (page !== undefined) watch(page.file);
  if (componentFile !== undefined) watch(componentFile);
  const summary =
    componentFile === undefined ? "" : moduleSummaryOf(scriptOfFile(componentFile, componentFiles));
  const value = { html: page?.html ?? "", summary };
  return { code: `export default ${JSON.stringify(value)};`, moduleType: "js" };
};

/**
 * The module that answers a `?forgebook-markdown` import: a source's Markdown file (its introduction) as HTML.
 *
 * @param file - the Markdown file's absolute path.
 * @param watch - adds a file whose edit renews the module (the Markdown file).
 */
const markdownModule = (file: string, watch: (file: string) => void): AnsweredModule => {
  watch(file);
  const value: StoryMarkdown = { html: markdownHtml(readFileSync(file, "utf8")) };
  return { code: `export default ${JSON.stringify(value)};`, moduleType: "js" };
};

/** What the text modules need of the plugin. */
export type TextModuleContext = {
  /** Adds a file whose edit renews the module. */
  readonly watch: (file: string) => void;
  /** Resolves an import of a file as the app resolves it; none when it does not resolve. */
  readonly resolveImport: (specifier: string, importer: string) => Promise<string | undefined>;
  /** The framework's own kind of component file; none when it has none. */
  readonly componentFiles: ComponentFiles | undefined;
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
    const storyFile = id.slice(0, -PAGE_QUERY.length);
    const specifier = componentImport(storyFile, readFileSync(storyFile, "utf8"));
    const componentFile =
      specifier === undefined ? undefined : await context.resolveImport(specifier, storyFile);
    return pageModule(storyFile, componentFile, context.watch, context.componentFiles);
  }
  if (id.endsWith(CODE_QUERY)) return codeModule(id.slice(0, -CODE_QUERY.length));
  if (id.endsWith(MARKDOWN_QUERY)) return markdownModule(id.slice(0, -MARKDOWN_QUERY.length), context.watch);
  return undefined;
};
