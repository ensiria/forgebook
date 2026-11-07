/**
 * Tests for what a catalogue's configuration file is refused for before anything runs: a key no version reads, a toolbar
 * naming no control; and the story patterns that match nothing. A file that does not load is the command's to show, in
 * `forgebookCommand.test.ts`: Vitest loads a file through its own transform, not as Node does.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import type { ForgebookConfig } from "../src/vite/config.ts";
import { loadConfigFile, resolveConfig } from "../src/vite/configFile.ts";
import { unknownKeysProblem } from "../src/vite/configKeys.ts";
import { placeInStack } from "../src/vite/configLoadError.ts";
import { emptyStoryGlobs } from "../src/vite/emptyStoryGlobs.ts";
import { unmatchedPatterns } from "../src/vite/storyPatterns.ts";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework.ts";

/** A new folder holding files, by name. */
const folderOf = (files: Readonly<Record<string, string>>): string => {
  const dir = mkdtempSync(join(tmpdir(), "forgebook-validation-"));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
};

/** A configuration with the least it needs. */
const BASE: ForgebookConfig = {
  framework: STUB_FRAMEWORK,
  title: "Catalogue",
  sources: ["@acme/ui/stories"]
};

/** A configuration with what no type allows, as JavaScript may write one. */
const withExtra = (extra: string): ForgebookConfig => ({ ...BASE, ...JSON.parse(extra) });

describe("unknownKeysProblem", () => {
  it("takes every key of a configuration and a preset", () => {
    expect(
      unknownKeysProblem({
        ...BASE,
        toolbar: ["theme"],
        build: { readableNames: true },
        shell: { branding: false, css: "a.css", theme: {} },
        a11y: { tags: [], disabledRules: [] },
        backgrounds: { builtIn: false, custom: [] },
        widthRange: { min: 1, max: 2 },
        controls: { sheets: false, direction: false, touch: false, embed: false, "forgebook.device": false },
        presets: [{ name: "acme", toolbar: ["theme"], preview: "/p.ts", head: "", shell: {} }]
      })
    ).toBeUndefined();
  });

  it("names a misspelt key and the closest valid one", () => {
    expect(unknownKeysProblem({ ...BASE, toolbr: [] })).toBe('it has no key "toolbr". Did you mean toolbar?');
    expect(unknownKeysProblem({ ...BASE, stoires: [] })).toContain("Did you mean stories?");
  });

  it("lists the keys when none is close, and every problem at once", () => {
    const problem = unknownKeysProblem({ ...BASE, addons: [], tilte: "x" }) ?? "";
    expect(problem).toContain('it has no key "addons". It takes id, widths,');
    expect(problem).toContain('it has no key "tilte". Did you mean title?');
  });

  it("reads one level down, and a preset's", () => {
    expect(unknownKeysProblem({ ...BASE, build: { readableName: true } })).toBe(
      'it has no key "build.readableName". Did you mean readableNames?'
    );
    expect(unknownKeysProblem({ ...BASE, controls: { sheet: false } })).toContain("Did you mean sheets?");
    expect(unknownKeysProblem({ ...BASE, presets: [{ name: "acme", toolbr: [] }] })).toBe(
      'its preset "acme": it has no key "toolbr". Did you mean toolbar?'
    );
    // a preset has no stories of its own
    expect(unknownKeysProblem({ ...BASE, presets: [{ name: "acme", stories: [] }] })).toContain(
      'its preset "acme": it has no key "stories"'
    );
  });

  it("leaves `tabs` to the plugins that add to it", () => {
    expect(unknownKeysProblem({ ...BASE, tabs: { "figma-design": false } })).toBeUndefined();
  });
});

describe("loadConfigFile", () => {
  it("stops on a misspelt key, naming the file and the key", async () => {
    const dir = folderOf({
      "forgebook.config.mts":
        'export default { framework: { name: "stub" }, title: "T", sources: ["a"], titel: "x" };\n'
    });
    await expect(loadConfigFile(join(dir, "forgebook.config.mts"))).rejects.toThrow(
      `${join(dir, "forgebook.config.mts")}: it has no key "titel". Did you mean title?`
    );
  });
});

describe("placeInStack", () => {
  it("reads Node's decorated stack, and nothing else", () => {
    const file = resolve("/a/b.ts");
    const rest = '\n  title: "x"\n  framework: 1,\n  ^^^^^^^^^\n};\n\nSyntaxError [X]: y';
    expect(placeInStack(`${pathToFileURL(file).href}:3${rest}`)).toEqual({ file, line: 3, column: 3 });
    expect(placeInStack(`${file}:3${rest}`)).toEqual({ file, line: 3, column: 3 });
    expect(placeInStack("SyntaxError: y\n    at z (node:internal:1:1)")).toBeUndefined();
  });

  it("reads a Windows path", () => {
    expect(placeInStack("C:\\a\\b.ts:2\n^^^\n")).toEqual({ file: "C:\\a\\b.ts", line: 2, column: 1 });
  });
});

describe("resolveConfig", () => {
  it("stops on a toolbar naming no control, saying which, as the shell would", () => {
    expect(() => resolveConfig(withExtra('{"toolbar":["nope"]}'), "/catalogue")).toThrow(
      'The toolbar names "nope", which is no control of the catalogue: it has theme, contrast'
    );
    expect(() => resolveConfig(withExtra('{"toolbar":["width","width"]}'), "/catalogue")).toThrow(
      'names "width" twice'
    );
  });

  it("takes a switch's id, a control turned off, a plugin's switch, and a preset's toolbar", () => {
    const toolbar = ["theme", "width", "audience"];
    expect(resolveConfig({ ...BASE, toolbar }, "/catalogue").lists.toolbar).toEqual(toolbar);
    expect(
      resolveConfig({ ...BASE, toolbar: ["sheets"], controls: { sheets: false } }, "/catalogue").lists.toolbar
    ).toEqual(["sheets"]);
    expect(
      resolveConfig(
        { ...BASE, plugins: [{ id: "probe", apiVersion: 1, switches: [] }], toolbar: ["theme"] },
        "/catalogue"
      ).lists.toolbar
    ).toEqual(["theme"]);
    expect(() =>
      resolveConfig({ ...BASE, presets: [{ name: "acme", toolbar: ["nope"] }] }, "/catalogue")
    ).toThrow('names "nope"');
  });

  it("stops on a view that cannot be read, which the shell would refuse too", () => {
    expect(() => resolveConfig({ ...BASE, views: [{ name: "Bad", view: "mauve" }] }, "/catalogue")).toThrow(
      'view "Bad"'
    );
  });
});

describe("the story patterns that match nothing", () => {
  const dir = folderOf({
    "src/Button.stories.tsx": "",
    "src/old/Legacy.stories.tsx": "",
    "drafts/Only.stories.tsx": ""
  });

  it("names each on its own, beside one that works", () => {
    expect(emptyStoryGlobs({ dir, stories: ["src/**/*.stories.tsx"] })).toEqual([]);
    expect(
      emptyStoryGlobs({ dir, stories: ["src/**/*.stories.tsx", "nothing/**/*.ts", "typo/*.tsx"] })
    ).toEqual(["nothing/**/*.ts", "typo/*.tsx"]);
    expect(emptyStoryGlobs({ dir, stories: [] })).toEqual([]);
  });

  it("counts a pattern that matches only folders as not matched", () => {
    mkdirSync(join(dir, "empty", "inner"), { recursive: true });
    expect(unmatchedPatterns(dir, ["empty/**"])).toEqual(["empty/**"]);
  });

  it("counts what a `!` pattern leaves out as not matched", () => {
    expect(unmatchedPatterns(dir, ["drafts/*.stories.tsx", "src/*.stories.tsx", "!drafts/**"])).toEqual([
      "drafts/*.stories.tsx"
    ]);
    expect(unmatchedPatterns(dir, ["src/**/*.stories.tsx", "!src/old/**"])).toEqual([]);
  });
});

describe("argControls", () => {
  const withControls = (argControls: Readonly<Record<string, string>>): ReturnType<typeof resolveConfig> =>
    resolveConfig(withExtra(JSON.stringify({ argControls })), "/catalogue");

  it("resolves a path from the configuration's folder, and keeps a package's specifier", () => {
    const { a, b } = withControls({ a: "./a.ts", b: "@acme/b" }).argControls;
    // on Windows, under the drive's letter
    expect(a).toMatch(/\/catalogue\/a\.ts$/);
    expect(b).toBe("@acme/b");
  });

  it("refuses a name of the panel's, a name no story can write, and no module", () => {
    expect(() => withControls({ select: "./a.ts" })).toThrow(/control of the panel/);
    expect(() => withControls({ "a b": "./a.ts" })).toThrow(/no name/);
    expect(() => withControls({ a: "" })).toThrow(/names no module/);
  });
});
