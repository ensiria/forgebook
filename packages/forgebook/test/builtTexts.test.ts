/**
 * Tests for a build's story-file texts: a text worth packing goes to a gzipped file the row names, one that weighs less
 * than that is written in the row, and the loaders answer each text as its query's module did.
 *
 * @module
 */
import { runInNewContext } from "node:vm";
import { gunzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { builtTexts } from "../src/vite/builtTexts.ts";
import type { IndexedStoryFile } from "../src/vite/storyFilesModule.ts";

/** A story file as a pattern's module lists it. */
const storyFile = (key: string): IndexedStoryFile => ({
  key,
  file: `/kit/${key}`,
  index: { title: key, stories: [] }
});

/** Docs long enough to be worth a file. */
const LONG_DOCS = {
  name: "Select",
  props: Array.from({ length: 12 }, (_, at) => ({ name: `prop${at}`, description: "What it sets." }))
};

describe("builtTexts", () => {
  it("packs a text worth a file, and writes in the module one that weighs less than its file", async () => {
    const written: { fileName: string; source: Uint8Array }[] = [];
    const texts = await builtTexts(
      [storyFile("A.stories.tsx")],
      {
        docsOf: async () => LONG_DOCS,
        codeOf: async () => ({}),
        pageOf: async () => ({ html: "", summary: "" })
      },
      (asset) => written.push(asset)
    );
    const loaders = texts.files.get("A.stories.tsx");
    expect(written).toHaveLength(1);
    expect(written[0]?.fileName).toMatch(/^assets\/[0-9a-f]{12}\.bin$/);
    expect(JSON.parse(gunzipSync(written[0]?.source ?? new Uint8Array()).toString())).toEqual(LONG_DOCS);
    expect(loaders?.docs).toBe(`packedText(${JSON.stringify(written[0]?.fileName)})`);
    expect(loaders?.code).toBe("writtenText0");
    expect(loaders?.page).toBe("writtenText1");
  });

  it("answers a text written in the module as its query's module did: docs that cannot be read too", async () => {
    const texts = await builtTexts(
      [storyFile("A.stories.tsx")],
      {
        docsOf: async () => ({ error: "Select.tsx could not be read" }),
        codeOf: async () => ({}),
        pageOf: async () => ({ html: "", summary: "" })
      },
      () => undefined
    );
    const loaders = texts.files.get("A.stories.tsx");
    // the packed files' maker reads `import.meta`, which only a module has: the texts written here need only theirs
    const writing = texts.helpers.filter((helper) => helper.startsWith("const writtenText"));
    const loaded: unknown = runInNewContext(
      `${writing.join("\n")}\n[${loaders?.docs}, ${loaders?.code}, ${loaders?.page}]`
    );
    if (!Array.isArray(loaded)) throw new Error("no loaders");
    const answers: unknown[] = await Promise.all(loaded.map((load: () => Promise<unknown>) => load()));
    expect(JSON.parse(JSON.stringify(answers))).toEqual([
      { error: "Select.tsx could not be read" },
      {},
      { html: "", summary: "" }
    ]);
  });

  it("writes a text once however many files share it, and names the files' texts by their content", async () => {
    const emitted: string[] = [];
    const texts = await builtTexts(
      [storyFile("A.stories.tsx"), storyFile("B.stories.tsx")],
      {
        docsOf: async () => LONG_DOCS,
        codeOf: async () => ({}),
        pageOf: async () => ({ html: "", summary: "" })
      },
      (asset) => emitted.push(asset.fileName)
    );
    expect(new Set(emitted).size).toBe(1);
    expect(texts.files.get("B.stories.tsx")).toEqual(texts.files.get("A.stories.tsx"));
    expect(texts.helpers.filter((helper) => helper.startsWith("const writtenText"))).toEqual([
      "const writtenText0 = () => Promise.resolve({});",
      'const writtenText1 = () => Promise.resolve({"html":"","summary":""});'
    ]);
  });

  it("loads the module that unpacks a file with the first packed text, never with the module that holds the rows", async () => {
    const texts = await builtTexts(
      [],
      { docsOf: async () => ({}), codeOf: async () => ({}), pageOf: async () => ({ html: "", summary: "" }) },
      () => undefined
    );
    const [maker] = texts.helpers;
    expect(maker).toMatch(/^const packedText = \(file\) => \{/);
    expect(maker).not.toMatch(/^import /m);
    // a load keeps its answer, as an imported module does, and forgets a failure for the next to ask again
    expect(maker).toContain("loading ??= import(");
    expect(maker).toContain("loading = undefined;");
  });
});
