/**
 * The modules the plugin answers from a story file or a Markdown file alone: a story file's component docs, its code
 * and its component's page, and a source's own Markdown.
 *
 * @module
 */
import { readFileSync } from "node:fs";

import type { StoryMarkdown } from "@forgebook/story-format/source";
import ts from "typescript-6";

import type { ComponentFiles } from "./adapter.ts";
import { componentPage, markdownHtml } from "./componentPage.ts";
import type { DocsResult } from "./docsExtractor.ts";
import { moduleSummaryOf } from "./docsProgram.ts";
import { highlightCode } from "./highlightCode.ts";
import { storyCode } from "./storyCode.ts";
import { componentImport } from "./storyMeta.ts";

/**
 * The module that answers a `?forgebook-docs` import: the story file's component docs, or `{ error }` for the panel.
 *
 * @param component - what the extractor read for the story file.
 * @param watch - adds a file whose edit renews the module.
 */
export const docsModule = (
  component: DocsResult,
  watch: (file: string) => void
): { code: string; moduleType: "js" } => {
  // the docs come from the component's files, not the story file the id names: Vite renews them on an edit only if
  // it watches those files too
  if (typeof component !== "string" && "sources" in component) {
    for (const file of component.sources) watch(file);
  }
  const value = typeof component === "string" ? { error: component } : component.docs;
  return { code: `export default ${JSON.stringify(value)};`, moduleType: "js" };
};

/**
 * The module that answers a `?forgebook-code` import: each story's `render` text and its coloured HTML, or `{ error }`
 * for the card.
 *
 * @param storyFile - the story file's absolute path; Vite renews the module when it changes, as the id names it.
 */
export const codeModule = (storyFile: string): { code: string; moduleType: "js" } => {
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
export const componentFileOf = async (
  storyFile: string,
  resolve: (specifier: string) => Promise<string | undefined>
): Promise<string | undefined> => {
  const specifier = componentImport(storyFile, readFileSync(storyFile, "utf8"));
  return specifier === undefined ? undefined : resolve(specifier);
};

/**
 * The text a component's file opens with, as TypeScript reads it: a framework's own kind of file (`.vue`) by its script.
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
export const pageModule = (
  storyFile: string,
  componentFile: string | undefined,
  watch: (file: string) => void,
  componentFiles: ComponentFiles | undefined
): { code: string; moduleType: "js" } => {
  const page = componentPage(storyFile);
  if (page !== undefined) watch(page.file);
  if (componentFile !== undefined) watch(componentFile);
  const summary =
    componentFile === undefined
      ? ""
      : moduleSummaryOf(
          ts.createSourceFile(
            componentFile,
            scriptOfFile(componentFile, componentFiles),
            ts.ScriptTarget.Latest,
            true
          )
        );
  const value = { html: page?.html ?? "", summary };
  return { code: `export default ${JSON.stringify(value)};`, moduleType: "js" };
};

/**
 * The module that answers a `?forgebook-markdown` import: a source's Markdown file (its introduction) as HTML.
 *
 * @param file - the Markdown file's absolute path.
 * @param watch - adds a file whose edit renews the module (the Markdown file).
 */
export const markdownModule = (
  file: string,
  watch: (file: string) => void
): { code: string; moduleType: "js" } => {
  watch(file);
  const value: StoryMarkdown = { html: markdownHtml(readFileSync(file, "utf8")) };
  return { code: `export default ${JSON.stringify(value)};`, moduleType: "js" };
};
