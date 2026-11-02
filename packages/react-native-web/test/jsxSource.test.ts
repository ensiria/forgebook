/**
 * Tests for the catalogue's JSX import source (NativeWind's) and Babel: named in the project's files only, never in
 * Forgebook's own, and Babel loaded only when the catalogue names plugins.
 *
 * @module
 */
import { join } from "node:path";

import type { Plugin } from "vite";
import { describe, expect, it } from "vitest";

import { babelPlugins } from "../src/vite/babelPlugins.ts";
import { isForgebookFile } from "../src/vite/forgebookFiles.ts";
import { nativePlugins } from "../src/vite/nativePlugin.ts";
import { NATIVE_FIXTURE_DIR } from "./fixturePaths.ts";

/**
 * Runs the JSX source plugin's transform on a file.
 *
 * @param plugins - the plugins.
 * @param code - the file's code.
 * @param id - its path.
 */
const jsxSource = async (plugins: readonly Plugin[], code: string, id: string): Promise<unknown> => {
  const hook = plugins.find((plugin) => plugin.name === "forgebook:react-native-web-jsx-source")?.transform;
  if (typeof hook !== "object" || !("handler" in hook)) throw new Error("no JSX source plugin");
  return Reflect.apply(hook.handler, undefined, [code, id, { moduleType: "tsx" }]);
};

describe("Forgebook's own files", () => {
  it("are told by the package that holds them, wherever it is", () => {
    expect(isForgebookFile(join(import.meta.dirname, "..", "src", "nativeRenderer.ts"))).toBe(true);
    expect(isForgebookFile(join(NATIVE_FIXTURE_DIR, "src", "TagChip.tsx"))).toBe(false);
    expect(isForgebookFile(join(import.meta.dirname, "project", "entry.tsx"))).toBe(false);
  });
});

describe("the JSX import source", () => {
  it("is named in each of the project's files, on its first line", async () => {
    const result = await jsxSource(
      nativePlugins({ jsxImportSource: "nativewind" }),
      "export const A = () => <b />;\nexport const B = 1;",
      join(NATIVE_FIXTURE_DIR, "src", "TagChip.tsx")
    );
    expect(result).toEqual({
      code: "/** @jsxImportSource nativewind */ export const A = () => <b />;\nexport const B = 1;",
      map: null
    });
  });

  it("is left out of Forgebook's own files, a file that names its own, and a catalogue that names none", async () => {
    const own = join(import.meta.dirname, "..", "src", "nativeRenderer.ts").replace(/\.ts$/, ".tsx");
    expect(await jsxSource(nativePlugins({ jsxImportSource: "nativewind" }), "<b />", own)).toBeNull();
    const project = join(NATIVE_FIXTURE_DIR, "src", "TagChip.tsx");
    expect(
      await jsxSource(
        nativePlugins({ jsxImportSource: "nativewind" }),
        "/** @jsxImportSource react */ <b />",
        project
      )
    ).toBeNull();
    expect(await jsxSource(nativePlugins({}), "<b />", project)).toBeNull();
  });
});

describe("Babel", () => {
  it("is not loaded without plugins or presets", async () => {
    expect(await babelPlugins({})).toEqual([]);
    expect(await babelPlugins({ babel: { plugins: [] } })).toEqual([]);
  });

  it("runs the plugins the catalogue names, through Rolldown's Babel plugin", async () => {
    const plugins = await babelPlugins({ babel: { plugins: ["react-native-worklets/plugin"] } });
    expect(plugins).toHaveLength(1);
  });
});
