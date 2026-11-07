/**
 * A build's story-file texts: each file's component docs, code and page, written as data in a module of their group's
 * rather than imported as a module each.
 *
 * @remarks
 * A dev server imports each text from its query (`?forgebook-docs`, `-code`, `-page`), so an edit renews the one it
 * changes. A build knows every file's texts, and a module each costs it a script per file and its loader in the group's
 * module, which every first load fetches. So a text is a gzipped file (the docs, a page that has something to say),
 * read when the page asks, as "Used in" is; and one that would weigh no more than its file's address (a story file
 * whose stories are all args has no code, most components have no page) is written in the module itself. Either way
 * the loader answers the text, as the query's module's default did.
 *
 * The packed texts of a group go in shared files, in the rows' order, up to `PACK_LIMIT` of JSON each, rather than a
 * file each: gzip reads each file alone, and the docs of neighbouring components repeat their keys, their types and
 * their wording, which a file of one text cannot share. On a library of small components a file each weighs ten times
 * what the same texts weigh together, and a page that asks for one text fetches a few kilobytes more.
 *
 * The texts are a module of their own (`TEXTS_PREFIX`), imported by the group's module alone, so the bundler keeps
 * them in its chunk. Reading them waits for every component's docs, seconds on a large library: written in the group's
 * module, they would hold back the stories it imports, and everything those import, until the last docs were read. As
 * a module of their own, the group's module is written at once and the build loads the stories while the docs are
 * read; the reading starts with the group's module (`starter`), and the texts' module waits for it.
 *
 * @module
 */

import { codeLiteral, codeOfJson } from "../codeLiteral.ts";
import { type EmitAsset, gzippedJson, packedFileName, packedLoaderMaker } from "./packedModule.ts";
import { FILES_PREFIX, TEXTS_ID_PREFIX } from "./pluginModules.ts";
import {
  type IndexedStoryFile,
  indexedStoryFiles,
  storyFilesGroupOf,
  storyFilesGroupText
} from "./storyFilesModule.ts";
import type { ComponentPageText, KeptCode, TextModuleContext } from "./textModules.ts";
import { VITE_PATHS } from "./vitePaths.ts";

/** What a build reads of a story file, by its absolute path: each text as its query's module answers it. */
type TextReaders = {
  /**
   * The component's docs, or `{ error }`: the framework's, whose shape the panel checks; none when the catalogue reads
   * no component docs.
   */
  readonly docsOf: ((storyFile: string) => Promise<unknown>) | undefined;
  /** Each story's `render` and its coloured HTML, or `{ error }`. */
  readonly codeOf: (storyFile: string) => Promise<KeptCode>;
  /** The component's documentation file as HTML and its file's summary. */
  readonly pageOf: (storyFile: string) => Promise<ComponentPageText>;
};

/** A story file's texts as their queries' modules answer them: its component's docs, its stories' code, its page. */
export type FileTexts = readonly [docs: unknown, code: KeptCode, page: ComponentPageText];

/** The function that makes a packed file's loader, in the generated code. */
const PACKED = "packedText";

/** The function that makes the loader of one text of a packed file, in the generated code. */
const PART = "packedPart";

/** The loaders of the packed files, in the generated code, numbered. */
const PACKED_FILE = "packedTexts";

/** The function that makes the loader of a text written in the module, in the generated code. */
const WRITTEN = "writtenText";

/**
 * The JSON a packed file holds at most, in characters, unless one text alone is longer: enough for the docs of a few
 * components to share their words, little enough that a page asking for one text fetches a few kilobytes.
 */
export const PACK_LIMIT = 64 * 1024;

/** The texts that go in one packed file, in their order, and the JSON they add up to. */
type Pack = { readonly texts: string[]; length: number };

/**
 * Writes texts as loaders: each in a packed file shared with its neighbours, or in the module when it weighs no more
 * than its loader there (an empty page, a story file with no code). A text is written once, however many files share
 * it, and its loader shared with them.
 */
const textWriter = (): {
  readonly loaderOf: (value: unknown) => string;
  readonly code: (emit: EmitAsset) => readonly string[];
} => {
  const written = new Map<string, string>();
  const packed = new Map<string, string>();
  const packs: Pack[] = [];
  const pack = (json: string): string => {
    const known = packed.get(json);
    if (known !== undefined) return known;
    let last = packs.at(-1);
    if (last === undefined || (last.texts.length > 0 && last.length + json.length > PACK_LIMIT)) {
      last = { texts: [], length: 0 };
      packs.push(last);
    }
    const loader = `${PART}(${PACKED_FILE}${packs.length - 1},${last.texts.length})`;
    last.texts.push(json);
    last.length += json.length;
    packed.set(json, loader);
    return loader;
  };
  return {
    loaderOf: (value: unknown): string => {
      const json = JSON.stringify(value);
      if (written.has(json) || json.length <= `${PART}(${PACKED_FILE}${packs.length},0)`.length) {
        const name = written.get(json) ?? `${WRITTEN}${written.size}`;
        written.set(json, name);
        return name;
      }
      return pack(json);
    },
    code: (emit: EmitAsset): readonly string[] => [
      ...[...written].map(([json, name]) => `const ${name} = () => Promise.resolve(${codeOfJson(json)});`),
      ...packs.map((each, at) => {
        const json = `[${each.texts.join(",")}]`;
        const fileName = packedFileName(json);
        emit({ type: "asset", fileName, source: gzippedJson(json) });
        return `const ${PACKED_FILE}${at} = ${PACKED}(${codeLiteral(fileName)});`;
      })
    ]
  };
};

/** The code of the function that makes the loader of one text of a packed file: it answers the same value each time. */
const PART_MAKER = `const ${PART} = (load, at) => () => load().then((texts) => texts[at]);`;

/**
 * Every file's texts, read: a build reads them all once, as it would for their modules.
 *
 * @param files - the group's story files, indexed.
 * @param read - reads a file's texts.
 * @returns each file's texts, in the files' order.
 */
const readTexts = (files: readonly IndexedStoryFile[], read: TextReaders): Promise<readonly FileTexts[]> =>
  Promise.all(
    files.map(({ file }) => Promise.all([read.docsOf?.(file), read.codeOf(file), read.pageOf(file)]))
  );

/**
 * The code of a group's texts module: the functions its loaders call, then, as its default, each file's loaders of its
 * docs, code and page, in the order of the group's rows.
 *
 * @param texts - each file's texts, in the files' order.
 * @param emit - writes a packed file.
 */
export const textsModuleCode = (texts: readonly FileTexts[], emit: EmitAsset): string => {
  // written in the files' order once all are read, so the names in the module do not depend on which read ended first
  const writer = textWriter();
  // a text not read (the docs of a catalogue that reads none) has no loader, and its place stays in the row
  const rows = texts.map(
    (each) => `[${each.map((text) => (text === undefined ? "null" : writer.loaderOf(text))).join(", ")}]`
  );
  return [
    packedLoaderMaker(PACKED),
    PART_MAKER,
    ...writer.code(emit),
    `export default [${rows.join(",\n")}];`
  ].join("\n");
};

/** What the plugin gives a build's texts: the docs as the panel reads them, and what reading a page needs. */
export type TextSources = Pick<TextModuleContext, "watch" | "resolveImport" | "componentFiles"> & {
  /** A story file's component docs as the panel reads them, or `{ error }`; none when the catalogue reads none. */
  readonly docsOf: ((storyFile: string) => Promise<unknown>) | undefined;
};

/**
 * A build's readers of the texts: the code and the pages as their queries answer them, read with the modules that
 * answer them, which load only when a build asks.
 *
 * @param sources - the docs, and what reading a page needs.
 */
const textReaders = async (sources: TextSources): Promise<TextReaders> => {
  const { storyFileCode, storyFilePage } = await import("./textModules.ts");
  return {
    docsOf: sources.docsOf,
    // a build keeps nothing between runs: it reads each file once
    codeOf: (storyFile: string) => storyFileCode(storyFile, undefined),
    pageOf: (storyFile: string) => storyFilePage(storyFile, sources)
  };
};

/** The module a build's texts are answered as. */
type TextsModule = { readonly code: string; readonly moduleType: "js" };

/** A build's texts, by group: read from when the group's module is written, answered as the texts' module. */
export type GroupTexts = {
  /**
   * What starts reading a pattern's texts as its module is written: the build loads the stories meanwhile.
   *
   * @param id - the pattern's module's id (`FILES_PREFIX`, then the group).
   * @param sources - what reading them needs.
   * @returns what starts the reading, given the story files in the order of the module's rows.
   */
  readonly starter: (id: string, sources: TextSources) => (files: readonly IndexedStoryFile[]) => void;
  /**
   * A group's texts module once its texts are read, when the id names one (`TEXTS_ID_PREFIX`). The files the reading
   * watched are watched by this module, the one an edit of them changes.
   *
   * @param id - the module's id.
   * @param sources - what reading them needs: its own `watch`, and the rest when its pattern's module did not start
   * the reading (a module loaded again).
   * @param emit - writes a packed file.
   * @returns the module; none for another id.
   */
  readonly moduleOf: (id: string, sources: TextSources, emit: EmitAsset) => Promise<TextsModule | undefined>;
};

/**
 * A group as its texts module's id writes it: the pattern's module names the folder as its importer's, the texts'
 * module in Vite's form (`storyFilesCode`), so both are read back and written the same way.
 *
 * @param group - the group (`storyFilesGroupText`).
 */
const groupKey = (group: string): string => {
  const { root, patterns } = storyFilesGroupOf(group);
  return storyFilesGroupText(VITE_PATHS.normalize(root), patterns);
};

/** A group's texts being read, with the files the reading watched. */
type Reading = {
  /** The texts, in the files' order. */
  readonly texts: Promise<readonly FileTexts[]>;
  /** The files the reading watched so far. */
  readonly watched: readonly string[];
};

/**
 * A build's texts, by group.
 *
 * @remarks
 * A reading started is kept until its module takes it, and marked handled at once: a failure before the module asks
 * would otherwise end the process, and the module's load still reports it. The reading outlives the load of the
 * pattern's module that started it, so it records the files it watches and the texts' module watches them.
 */
export const groupTexts = (): GroupTexts => {
  const started = new Map<string, Reading>();
  const read = async (
    files: readonly IndexedStoryFile[],
    sources: TextSources
  ): Promise<readonly FileTexts[]> => readTexts(files, await textReaders(sources));
  const code = async (group: string, sources: TextSources, emit: EmitAsset): Promise<string> => {
    const key = groupKey(group);
    const reading = started.get(key);
    started.delete(key);
    if (reading === undefined) {
      const { root, patterns } = storyFilesGroupOf(group);
      return textsModuleCode(await read(indexedStoryFiles(root, patterns, sources.watch), sources), emit);
    }
    const texts = await reading.texts;
    for (const file of reading.watched) sources.watch(file);
    return textsModuleCode(texts, emit);
  };
  return {
    starter:
      (id: string, sources: TextSources) =>
      (files: readonly IndexedStoryFile[]): void => {
        const watched: string[] = [];
        const texts = read(files, { ...sources, watch: (file: string): void => void watched.push(file) });
        texts.catch(() => undefined);
        started.set(groupKey(id.slice(FILES_PREFIX.length)), { texts, watched });
      },
    moduleOf: async (id: string, sources: TextSources, emit: EmitAsset): Promise<TextsModule | undefined> => {
      if (!id.startsWith(TEXTS_ID_PREFIX)) return undefined;
      return { code: await code(id.slice(TEXTS_ID_PREFIX.length), sources, emit), moduleType: "js" };
    }
  };
};
