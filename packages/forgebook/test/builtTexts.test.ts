/**
 * Tests for a build's story-file texts: a text worth packing goes to a gzipped file the texts module names, one that
 * weighs less than that is written in the module, the loaders answer each text as its query's module did, and the
 * reading starts with the group's module without holding it back.
 *
 * @module
 */
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { gunzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { codeLiteral } from "../src/codeLiteral.ts";
import {
  type FileTexts,
  type GroupTexts,
  groupTexts,
  type TextSources,
  textsModuleCode
} from "../src/vite/builtTexts.ts";
import { FILES_PREFIX, TEXTS_ID_PREFIX } from "../src/vite/pluginModules.ts";
import { storyFilesGroupText } from "../src/vite/storyFilesModule.ts";
import { VITE_PATHS } from "../src/vite/vitePaths.ts";
import { KIT_DIR } from "./fixturePaths.ts";

/** Docs long enough to be worth a file. */
const LONG_DOCS = {
  name: "Select",
  props: Array.from({ length: 12 }, (_, at) => ({ name: `prop${at}`, description: "What it sets." }))
};

/** A file's texts with nothing to say: no code, an empty page. */
const EMPTY: FileTexts = [{}, {}, { html: "", summary: "" }];

/**
 * The loaders of each row of a texts module's default, as written.
 *
 * @param code - the module's code.
 */
const rowsOf = (code: string): string[][] => {
  const [, list = ""] = code.split("export default [");
  return list
    .replace(/\];$/, "")
    .split(",\n")
    .filter((row) => row !== "")
    .map((row) => row.slice(1, -1).split(", "));
};

describe("textsModuleCode", () => {
  it("packs a text worth a file, and writes in the module one that weighs less than its file", () => {
    const written: { fileName: string; source: Uint8Array }[] = [];
    const code = textsModuleCode([[LONG_DOCS, {}, { html: "", summary: "" }]], (asset) =>
      written.push(asset)
    );
    expect(written).toHaveLength(1);
    expect(written[0]?.fileName).toMatch(/^assets\/[0-9a-f]{12}\.bin$/);
    expect(JSON.parse(gunzipSync(written[0]?.source ?? new Uint8Array()).toString())).toEqual(LONG_DOCS);
    expect(rowsOf(code)).toEqual([
      [`packedText(${codeLiteral(written[0]?.fileName)})`, "writtenText0", "writtenText1"]
    ]);
  });

  it("answers a text written in the module as its query's module did: docs that cannot be read too", async () => {
    const code = textsModuleCode(
      [[{ error: "Select.tsx could not be read" }, {}, { html: "", summary: "" }]],
      () => 0
    );
    // the packed files' maker reads `import.meta`, which only a module has: the texts written here need only theirs
    const writing = code.split("\n").filter((line) => line.startsWith("const writtenText"));
    const [row = []] = rowsOf(code);
    const loaded: unknown = runInNewContext(`${writing.join("\n")}\n[${row.join(", ")}]`);
    if (!Array.isArray(loaded)) throw new Error("no loaders");
    const answers: unknown[] = await Promise.all(loaded.map((load: () => Promise<unknown>) => load()));
    expect(JSON.parse(JSON.stringify(answers))).toEqual([
      { error: "Select.tsx could not be read" },
      {},
      { html: "", summary: "" }
    ]);
  });

  it("writes a text once however many files share it, and names the files' texts by their content", () => {
    const emitted: string[] = [];
    const docs: FileTexts = [LONG_DOCS, {}, { html: "", summary: "" }];
    const code = textsModuleCode([docs, docs], (asset) => emitted.push(asset.fileName));
    expect(new Set(emitted).size).toBe(1);
    const [first, second] = rowsOf(code);
    expect(second).toEqual(first);
    expect(code.split("\n").filter((line) => line.startsWith("const writtenText"))).toEqual([
      "const writtenText0 = () => Promise.resolve({});",
      'const writtenText1 = () => Promise.resolve({"html":"","summary":""});'
    ]);
  });

  it("loads the module that unpacks a file with the first packed text, never with the module that holds the rows", () => {
    const code = textsModuleCode([EMPTY], () => 0);
    expect(code).toMatch(/^const packedText = \(file\) => \{/);
    expect(code).not.toMatch(/^import /m);
    // a load keeps its answer, as an imported module does, and forgets a failure for the next to ask again
    expect(code).toContain("loading ??= import(");
    expect(code).toContain("loading = undefined;");
  });
});

/** A story file of the fixture kit whose stories have a render and whose component has a page. */
const SELECT = "./src/Select.stories.tsx";

/** The kit's group of one story file: its folder in Vite's form, as the texts module's id writes it. */
const GROUP = storyFilesGroupText(VITE_PATHS.normalize(KIT_DIR), SELECT);

/** The kit's pattern's module's id. */
const FILES_ID = `${FILES_PREFIX}${GROUP}`;

/** The kit's texts module's id. */
const TEXTS_ID = `${TEXTS_ID_PREFIX}${GROUP}`;

/**
 * A texts module's code, or none, with the docs it packed.
 *
 * @param texts - the build's texts.
 * @param sources - what reading them needs.
 */
const textsCode = async (
  texts: GroupTexts,
  sources: TextSources
): Promise<{ readonly code: string | undefined; readonly packed: readonly string[] }> => {
  const packed: string[] = [];
  const emit = (asset: { readonly source: Uint8Array }): number =>
    packed.push(gunzipSync(asset.source).toString());
  return { code: (await texts.moduleOf(TEXTS_ID, sources, emit))?.code, packed };
};

/** A promise and what settles it, for docs that arrive when the test says. */
const deferred = <TValue>(): { promise: Promise<TValue>; resolve: (value: TValue) => void } => {
  let resolve: (value: TValue) => void = () => undefined;
  const promise = new Promise<TValue>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

/**
 * What reading the kit's texts needs, with docs that arrive when the test says.
 *
 * @param docs - answers the docs.
 * @param asked - told when the docs are asked for.
 * @param watched - receives the files watched.
 */
const kitSources = (
  docs: () => Promise<unknown>,
  asked: () => void,
  watched: string[] = []
): TextSources => ({
  docsOf: (): Promise<unknown> => {
    asked();
    return docs();
  },
  watch: (file: string): void => void watched.push(file),
  resolveImport: async (): Promise<undefined> => undefined,
  componentFiles: undefined
});

describe("groupTexts", () => {
  it("starts reading with the group's module, which is written before the texts are read", async () => {
    const texts = groupTexts();
    const docs = deferred<unknown>();
    const asked = deferred<undefined>();
    const sources = kitSources(
      () => docs.promise,
      () => asked.resolve(undefined)
    );
    const file = join(KIT_DIR, SELECT);
    texts.starter(FILES_ID, sources)([{ key: SELECT, file, index: { title: "Select", stories: [] } }]);
    // the docs are asked for with no texts module loaded yet
    await asked.promise;
    let isWritten = false;
    const written = textsCode(texts, sources).then((module) => {
      isWritten = true;
      return module;
    });
    await new Promise((settle) => setTimeout(settle, 10));
    expect(isWritten).toBe(false);
    docs.resolve(LONG_DOCS);
    const { code, packed } = await written;
    const [row = []] = rowsOf(code ?? "");
    expect(row).toHaveLength(3);
    expect(packed.some((text) => text.includes('"name":"Select"'))).toBe(true);
  });

  it("watches in the texts' module the files the reading watched, after the pattern's module was written", async () => {
    const texts = groupTexts();
    const byPattern: string[] = [];
    const byTexts: string[] = [];
    const file = join(KIT_DIR, SELECT);
    const start = texts.starter(
      FILES_ID,
      kitSources(
        async () => LONG_DOCS,
        () => undefined,
        byPattern
      )
    );
    start([{ key: SELECT, file, index: { title: "Select", stories: [] } }]);
    await textsCode(
      texts,
      kitSources(
        async () => LONG_DOCS,
        () => undefined,
        byTexts
      )
    );
    expect(byPattern).toEqual([]);
    // the component's page, which the reading watched
    expect(byTexts.some((watched) => watched.endsWith(".md"))).toBe(true);
  });

  it("reads a group's texts itself when its module did not start them, and reports a reading that failed", async () => {
    const texts = groupTexts();
    const sources = kitSources(
      async () => LONG_DOCS,
      () => undefined
    );
    expect(await texts.moduleOf(FILES_ID, sources, () => 0)).toBeUndefined();
    const { packed } = await textsCode(texts, sources);
    expect(packed.some((text) => text.includes('"name":"Select"'))).toBe(true);
    const failing = kitSources(
      () => Promise.reject(new Error("no docs")),
      () => undefined
    );
    const file = join(KIT_DIR, SELECT);
    texts.starter(FILES_ID, failing)([{ key: SELECT, file, index: { title: "Select", stories: [] } }]);
    // a failure before the module asks ends nothing, and its module's load still says why
    await new Promise((settle) => setTimeout(settle, 10));
    await expect(textsCode(texts, sources)).rejects.toThrow("no docs");
  });
});
