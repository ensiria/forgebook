/**
 * A build's story-file texts: each file's component docs, code and page, written into its group's module as data
 * rather than imported as a module each.
 *
 * @remarks
 * A dev server imports each text from its query (`?forgebook-docs`, `-code`, `-page`), so an edit renews the one it
 * changes. A build knows every file's texts before it writes the group's module, and a module each costs it a script
 * per file and its loader in the group's module, which every first load fetches. So a text is a gzipped file (the
 * docs, a page that has something to say), read when the page asks, as "Used in" is; and one that would weigh no more
 * than its file's address (a story file whose stories are all args has no code, most components have no page) is
 * written in the row itself. Either way the loader answers the text, as the query's module's default did.
 *
 * @module
 */

import { type EmitAsset, gzippedJson, packedFileName, packedLoaderMaker } from "./packedModule.ts";
import type { IndexedStoryFile } from "./storyFilesModule.ts";
import type { ComponentPageText, KeptCode, TextModuleContext } from "./textModules.ts";

/** What a build reads of a story file, by its absolute path: each text as its query's module answers it. */
export type TextReaders = {
  /** The component's docs, or `{ error }`: the framework's, whose shape the panel checks. */
  readonly docsOf: (storyFile: string) => Promise<unknown>;
  /** Each story's `render` and its coloured HTML, or `{ error }`. */
  readonly codeOf: (storyFile: string) => Promise<KeptCode>;
  /** The component's documentation file as HTML and its file's summary. */
  readonly pageOf: (storyFile: string) => Promise<ComponentPageText>;
};

/** One story file's loaders, as code: each an expression of a function that answers the text. */
export type FileTextLoaders = {
  /** The component's docs. */
  readonly docs: string;
  /** The stories' code. */
  readonly code: string;
  /** The component's page. */
  readonly page: string;
};

/** A group's texts, written: the functions the loaders call, and each file's loaders by its key. */
export type BuiltTexts = {
  /** The statements that define the functions the loaders call, before the rows. */
  readonly helpers: readonly string[];
  /** Each file's loaders, by its key. */
  readonly files: ReadonlyMap<string, FileTextLoaders>;
};

/** The function that makes a packed file's loader, in the generated code. */
const PACKED = "packedText";

/** The function that makes the loader of a text written in the module, in the generated code. */
const WRITTEN = "writtenText";

/**
 * Writes the texts of a group: each in a gzipped file, or in the module when that weighs no more than the file and its
 * address (an empty page's JSON is shorter than its gzip header and the fetch it would cost). A text written in the
 * module is written once, however many files share it (most story files have no code and no page), and its loader
 * shared with them.
 *
 * @param emit - writes a packed file.
 */
const textWriter = (
  emit: EmitAsset
): { readonly loaderOf: (value: unknown) => string; readonly written: () => readonly string[] } => {
  const names = new Map<string, string>();
  return {
    loaderOf: (value: unknown): string => {
      const json = JSON.stringify(value);
      const fileName = packedFileName(json);
      const address = JSON.stringify(fileName);
      const packed = gzippedJson(json);
      if (json.length <= address.length + packed.length) {
        const name = names.get(json) ?? `${WRITTEN}${names.size}`;
        names.set(json, name);
        return name;
      }
      emit({ type: "asset", fileName, source: packed });
      return `${PACKED}(${address})`;
    },
    written: (): readonly string[] =>
      [...names].map(([json, name]) => `const ${name} = () => Promise.resolve(${json});`)
  };
};

/**
 * Every file's texts, read and written: a build reads them all once, as it would for their modules.
 *
 * @param files - the group's story files, indexed.
 * @param read - reads a file's texts.
 * @param emit - writes a packed file.
 */
export const builtTexts = async (
  files: readonly IndexedStoryFile[],
  read: TextReaders,
  emit: EmitAsset
): Promise<BuiltTexts> => {
  const readFiles = await Promise.all(
    files.map(async ({ key, file }) => ({
      key,
      texts: await Promise.all([read.docsOf(file), read.codeOf(file), read.pageOf(file)])
    }))
  );
  // written in the files' order once all are read, so the names in the module do not depend on which read ended first
  const writer = textWriter(emit);
  const loaders = readFiles.map(({ key, texts: [docs, code, page] }): [string, FileTextLoaders] => [
    key,
    { docs: writer.loaderOf(docs), code: writer.loaderOf(code), page: writer.loaderOf(page) }
  ]);
  return { helpers: [packedLoaderMaker(PACKED), ...writer.written()], files: new Map(loaders) };
};

/** What the plugin gives a build's texts: the docs as the panel reads them, and what reading a page needs. */
export type TextSources = Pick<TextModuleContext, "watch" | "resolveImport" | "componentFiles"> & {
  /** A story file's component docs as the panel reads them, or `{ error }`. */
  readonly docsOf: (storyFile: string) => Promise<unknown>;
};

/**
 * Writes a pattern's texts as a build's group module holds them: the code and the pages as their queries answer them,
 * read with the modules that answer them, which load only when a build asks.
 *
 * @param sources - the docs, and what reading a page needs.
 * @param emit - writes a packed file.
 */
export const textsWriter =
  (sources: TextSources, emit: EmitAsset) =>
  async (files: readonly IndexedStoryFile[]): Promise<BuiltTexts> => {
    const { storyFileCode, storyFilePage } = await import("./textModules.ts");
    return builtTexts(
      files,
      {
        docsOf: sources.docsOf,
        // a build keeps nothing between runs: it reads each file once
        codeOf: (storyFile: string) => storyFileCode(storyFile, undefined),
        pageOf: (storyFile: string) => storyFilePage(storyFile, sources)
      },
      emit
    );
  };
