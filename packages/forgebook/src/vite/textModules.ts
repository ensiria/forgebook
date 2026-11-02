/**
 * The modules the plugin makes from a file's text: a story file's code (`?forgebook-code`), a component's page
 * (`?forgebook-page`) and a source's Markdown file (`?forgebook-markdown`).
 *
 * @remarks
 * Kept apart from the plugin, which imports this module on the first of these queries: colouring code loads
 * highlight.js and the TypeScript compiler, a tenth of a story page's memory that a story's page never uses.
 *
 * @module
 */
import { readFileSync } from "node:fs";

import type { StoryMarkdown } from "@forgebook/story-format/source";

import { componentPage, markdownHtml } from "./componentPage.ts";
import { highlightCode } from "./highlightCode.ts";
import { componentImport } from "./indexStoryFile.ts";
import { moduleSummaryOfText } from "./moduleSummary.ts";
import { storyCode } from "./storyCode.ts";

/** The query that asks for a story file's code: each story's `render` as written. */
const CODE_QUERY = "?forgebook-code";

/** The query that asks for a story file's component page: its documentation file as HTML. */
const PAGE_QUERY = "?forgebook-page";

/** The query a source's Markdown file is imported with (its introduction on the home), answered with its HTML. */
const MARKDOWN_QUERY = "?forgebook-markdown";

/**
 * The module that answers a `?forgebook-code` import: each story's `render` text and its coloured HTML, or `{ error }`
 * for the card.
 *
 * @param storyFile - the story file's absolute path; Vite renews the module when it changes, as the id names it.
 */
const codeModule = (storyFile: string): { code: string; moduleType: "js" } => {
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
 */
const pageModule = (
  storyFile: string,
  componentFile: string | undefined,
  watch: (file: string) => void
): { code: string; moduleType: "js" } => {
  const page = componentPage(storyFile);
  if (page !== undefined) watch(page.file);
  if (componentFile !== undefined) watch(componentFile);
  const summary = componentFile === undefined ? "" : moduleSummaryOfText(readFileSync(componentFile, "utf8"));
  const value = { html: page?.html ?? "", summary };
  return { code: `export default ${JSON.stringify(value)};`, moduleType: "js" };
};

/**
 * The module that answers a `?forgebook-markdown` import: a source's Markdown file (its introduction) as HTML.
 *
 * @param file - the Markdown file's absolute path.
 * @param watch - adds a file whose edit renews the module (the Markdown file).
 */
const markdownModule = (file: string, watch: (file: string) => void): { code: string; moduleType: "js" } => {
  watch(file);
  const value: StoryMarkdown = { html: markdownHtml(readFileSync(file, "utf8")) };
  return { code: `export default ${JSON.stringify(value)};`, moduleType: "js" };
};

/**
 * The module a query asks for, when the id is one.
 *
 * @param id - the module's id.
 * @param watch - adds a file whose edit renews the module.
 * @param resolveImport - resolves an import of a file as the app resolves it.
 */
export const textModule = async (
  id: string,
  watch: (file: string) => void,
  resolveImport: (specifier: string, importer: string) => Promise<string | undefined>
): Promise<{ code: string; moduleType: "js" } | undefined> => {
  if (id.endsWith(PAGE_QUERY)) {
    const storyFile = id.slice(0, -PAGE_QUERY.length);
    const componentFile = await componentFileOf(storyFile, (specifier: string) =>
      resolveImport(specifier, storyFile)
    );
    return pageModule(storyFile, componentFile, watch);
  }
  if (id.endsWith(CODE_QUERY)) return codeModule(id.slice(0, -CODE_QUERY.length));
  if (id.endsWith(MARKDOWN_QUERY)) return markdownModule(id.slice(0, -MARKDOWN_QUERY.length), watch);
  return undefined;
};
