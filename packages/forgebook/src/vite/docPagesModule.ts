/**
 * The modules that answer a `?forgebook-docs-pages` import: every page a pattern matches as one module with each page's
 * index, and the loader of the page itself, and each page's own module.
 *
 * @remarks
 * Shaped as `?forgebook-files` is, and keyed the same way: the sidebar needs every page's title at once, and a page's
 * rendered blocks only when it opens. The Markdown itself goes to tools on the dev server alone: a static build has no
 * tools to ask, and it would ship every page twice.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { DocPageIndex } from "@forgebook/story-format/source";

import { compiledDocPage, docPageIndex } from "./docPageMarkdown.ts";
import { storyFileKeys } from "./storyFilesModule.ts";

/** The query that asks for one docs page, rendered. */
export const DOCS_PAGE_QUERY = "?forgebook-docs-page";

/** A page a pattern matches, with its key and its index. */
export type IndexedDocPage = {
  /** Its path relative to the declaring module (`./docs/theming.md`). */
  readonly key: string;
  /** Its absolute path. */
  readonly file: string;
  /** Its index. */
  readonly index: DocPageIndex;
};

/**
 * Every page a pattern matches, indexed.
 *
 * @param root - the declaring module's folder.
 * @param pattern - the pattern.
 * @param watch - adds a file whose edit renews the module that read it.
 */
export const indexedDocPages = (
  root: string,
  pattern: string,
  watch: (file: string) => void
): IndexedDocPage[] => {
  const keys = storyFileKeys(root, [pattern]);
  const files = new Set(keys.map((key) => resolve(root, key)));
  return keys.map((key) => {
    const file = resolve(root, key);
    watch(file);
    const index = docPageIndex(file, readFileSync(file, "utf8"), (other: string) => files.has(other));
    return { key, file, index };
  });
};

/** An object literal of a key per page, each value written by `value`. */
const objectOf = (keys: readonly string[], value: (key: string) => string): string =>
  `{${keys.map((key) => `${JSON.stringify(key)}: ${value(key)}`).join(",\n")}}`;

/**
 * The code of the module for one pattern.
 *
 * @param root - the declaring module's folder.
 * @param pattern - the pattern before `?forgebook-docs-pages`.
 * @param watch - adds a file whose edit renews the module (each page: its index is in the module).
 * @param isServing - whether a dev server runs, whose tools read a page's Markdown.
 */
export const docPagesModule = (
  root: string,
  pattern: string,
  watch: (file: string) => void,
  isServing: boolean
): string => {
  const pages = indexedDocPages(root, pattern, watch);
  const keys = pages.map((page) => page.key);
  const index: Record<string, DocPageIndex> = Object.fromEntries(pages.map((page) => [page.key, page.index]));
  const page = (key: string): string => JSON.stringify(`${resolve(root, key)}${DOCS_PAGE_QUERY}`);
  return [
    "export default {",
    `index: ${JSON.stringify(index)},`,
    `pages: ${objectOf(keys, (key) => `() => import(${page(key)}).then((module) => module.default)`)},`,
    ...(isServing
      ? [`text: ${objectOf(keys, (key) => `() => import(${page(key)}).then((module) => module.text)`)}`]
      : []),
    "};"
  ].join("\n");
};

/**
 * The code of one page's module: what the shell draws, each image imported so Vite answers its address, and, on the dev
 * server, the page's Markdown for tools.
 *
 * @param file - the page's file, absolute.
 * @param watch - adds a file whose edit renews the module.
 * @param isServing - whether a dev server runs.
 */
export const docPageModule = (file: string, watch: (file: string) => void, isServing: boolean): string => {
  watch(file);
  const { blocks, headings, images, text } = compiledDocPage(file, readFileSync(file, "utf8"));
  return [
    ...images.map((image, place) => `import asset${place} from ${JSON.stringify(`${image}?url`)};`),
    `export default { blocks: ${JSON.stringify(blocks)}, headings: ${JSON.stringify(headings)}, assets: [${images
      .map((_image, place) => `asset${place}`)
      .join(", ")}] };`,
    ...(isServing ? [`export const text = ${JSON.stringify(text)};`] : [])
  ].join("\n");
};
