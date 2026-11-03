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

import type { ForgebookPlugin } from "../plugin.ts";
import { compiledDocPage, docPageIndex, readLinkedFile } from "./docPageMarkdown.ts";
import { pluginFences } from "./pluginConfig.ts";
import { storyFileKeys } from "./storyFilesModule.ts";
import { DOCS_PAGE_QUERY } from "./textQueries.ts";
import { VITE_PATHS } from "./vitePaths.ts";

/** A page a pattern matches, with its key and its index. */
export type IndexedDocPage = {
  /** Its path relative to the declaring module (`./docs/theming.md`). */
  readonly key: string;
  /** Its absolute path. */
  readonly file: string;
  /** Its index. */
  readonly index: DocPageIndex;
};

/** Reads a linked page, watching it: its title makes the link's address, so a new title renews the page that links. */
const watchedRead =
  (watch: (file: string) => void) =>
  (file: string): string | undefined => {
    const text = readLinkedFile(file);
    if (text !== undefined) watch(file);
    return text;
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
  return storyFileKeys(root, [pattern]).map((key) => {
    const file = resolve(root, key);
    watch(file);
    return { key, file, index: docPageIndex(file, readFileSync(file, "utf8"), watchedRead(watch)) };
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
  const page = (key: string): string => JSON.stringify(`${VITE_PATHS.resolve(root, key)}${DOCS_PAGE_QUERY}`);
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
 * @param plugins - the catalogue's plugins, whose fences a page may draw.
 */
export const docPageModule = (
  file: string,
  watch: (file: string) => void,
  isServing: boolean,
  plugins: readonly ForgebookPlugin[] = []
): string => {
  watch(file);
  const { blocks, headings, images, text } = compiledDocPage(
    file,
    readFileSync(file, "utf8"),
    watchedRead(watch),
    pluginFences(plugins)
  );
  return [
    ...images.map(
      (image, place) => `import asset${place} from ${JSON.stringify(`${VITE_PATHS.normalize(image)}?url`)};`
    ),
    `export default { blocks: ${JSON.stringify(blocks)}, headings: ${JSON.stringify(headings)}, assets: [${images
      .map((_image, place) => `asset${place}`)
      .join(", ")}] };`,
    ...(isServing ? [`export const text = ${JSON.stringify(text)};`] : [])
  ].join("\n");
};
