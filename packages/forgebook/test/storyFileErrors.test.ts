/**
 * Tests for a story file that cannot be read: one problem naming its place while the others draw, a build and a test
 * run that still fail on it, and an edit that breaks or fixes it on a dev server.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { StorySource } from "@forgebook/story-format/source";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildFailureText } from "../bin/forgebook/buildFailure.ts";
import { bundlerErrorLines } from "../src/bundlerErrors.ts";
import { STORY_FILE_READ_EVENT, storyFileReadOf } from "../src/hotModules.ts";
import { storyTree } from "../src/storyTree.ts";
import { filesModuleHot, servedPatterns, storyFileHotHooks } from "../src/vite/hotSnippets.ts";
import { indexStoryFile } from "../src/vite/indexStoryFile.ts";
import { FILES_PREFIX, patternModule, usageModule } from "../src/vite/pluginModules.ts";
import { scanOptions } from "../src/vite/prebundled.ts";
import {
  indexedStoryFiles,
  readStoryFiles,
  storyFilesCode,
  storyFilesGroupText
} from "../src/vite/storyFilesModule.ts";
import { VITE_PATHS } from "../src/vite/vitePaths.ts";

const GOOD = 'export default { title: "Good" };\nexport const Main = {};\n';
const BAD = 'export default { title: "Bad" };\nexport const Main = { args: { a: 1 };\n';
const NO_LOADERS = { hasUsage: false, hasReach: false };

let dir = "";
let goodFile = "";
let badFile = "";

/** A pattern's module id, for the story files of the test's folder. */
const moduleId = (): string =>
  `${FILES_PREFIX}${storyFilesGroupText(VITE_PATHS.normalize(dir), ["./*.stories.tsx"])}`;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "forgebook-story-errors-"));
  mkdirSync(dir, { recursive: true });
  // in Vite's form, as the plugin keeps and names them
  goodFile = VITE_PATHS.normalize(join(dir, "good.stories.tsx"));
  badFile = VITE_PATHS.normalize(join(dir, "bad.stories.tsx"));
  writeFileSync(goodFile, GOOD);
  writeFileSync(badFile, BAD);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("where a story file does not parse", () => {
  it("counts lines and columns as an editor does, past a character of two code units", () => {
    expect(indexStoryFile("a.tsx", 'const s = "è😀é";\nexport const M = { a: 1 ;\n')).toMatch(
      /^a\.tsx:2:25 does not parse: /
    );
    expect(indexStoryFile("a.tsx", "// one\r\n// two\r\nexport const = 1;\n")).toMatch(
      /^a\.tsx:3:14 does not parse: /
    );
  });
});

describe("a group with a file that cannot be read", () => {
  it("reads the others and names it", () => {
    const watched: string[] = [];
    const { files, refused } = readStoryFiles(dir, ["./*.stories.tsx"], (file) => void watched.push(file));
    expect(files.map(({ index }) => index.title)).toEqual(["Good"]);
    expect(refused).toHaveLength(1);
    expect(refused[0]?.problem).toMatch(/bad\.stories\.tsx:2:\d+ does not parse: /);
    // its fix has to reach the module
    expect(watched).toContain(badFile);
  });

  it("names every such file to who cannot go on without them", () => {
    writeFileSync(join(dir, "worse.stories.tsx"), "export const = ;\n");
    expect(() => indexedStoryFiles(dir, ["./*.stories.tsx"], () => undefined)).toThrow(
      /bad\.stories\.tsx:2:\d+ does not parse.*\n.*worse\.stories\.tsx:1:\d+ does not parse/
    );
  });

  it("fails a module no person is at, and lists it in the one a dev server serves", () => {
    const module = (isForgiving: boolean): ReturnType<typeof patternModule> =>
      patternModule(
        moduleId(),
        () => undefined,
        NO_LOADERS,
        undefined,
        undefined,
        undefined,
        undefined,
        isForgiving
      );
    expect(() => module(false)).toThrow(/does not parse/);
    const forgiven = module(true);
    expect(forgiven.files.map(({ file }) => file)).toEqual([goodFile]);
    expect(forgiven.code).toContain("problems: [");
    expect(forgiven.code).toContain("does not parse");
  });

  it("writes no problems in the module of a group that has none", () => {
    expect(storyFilesCode(dir, ["./*.stories.tsx"], [], NO_LOADERS)).not.toContain("problems");
  });

  it("leaves it out of the group's Used in", async () => {
    const asked: string[] = [];
    await usageModule(
      `\0virtual:forgebook-usage:${storyFilesGroupText(VITE_PATHS.normalize(dir), ["./*.stories.tsx"])}`,
      () => undefined,
      async (stories) => {
        asked.push(...stories.map(({ storyFile }) => storyFile));
        return "not read";
      },
      undefined,
      (json) => json
    );
    expect(asked).toEqual([goodFile]);
  });

  it("is one problem of the tree, whose other stories stay", () => {
    const source: StorySource = {
      id: "app",
      name: "App",
      files: [
        {
          index: { "./good.stories.tsx": { title: "Good", stories: [{ exportName: "Main" }] } },
          stories: {},
          docs: {},
          code: {},
          pages: {},
          problems: ["/app/bad.stories.tsx:2:38 does not parse: Expected"]
        }
      ],
      sheets: { required: [], theme: [], restyled: [] }
    };
    const tree = storyTree([source]);
    expect(tree.problems).toEqual(["/app/bad.stories.tsx:2:38 does not parse: Expected"]);
    expect(tree.sources[0]?.families).toHaveLength(1);
  });
});

describe("an edit on a dev server", () => {
  /** A served group of the test's folder, as the plugin keeps it. */
  const served = (): ReturnType<typeof servedPatterns> => {
    const patterns = servedPatterns();
    patterns.keep(
      moduleId(),
      readStoryFiles(dir, ["./*.stories.tsx"], () => undefined)
    );
    return patterns;
  };

  it("that breaks a story file changes no list and says so; its fix says so, and reloads only for a new list", () => {
    const patterns = served();
    writeFileSync(goodFile, "export const = ;\n");
    const broken = patterns.edited(goodFile);
    expect(broken.changed).toEqual([]);
    expect(broken.renewed).toEqual([moduleId()]);
    expect(broken.read?.file).toBe(goodFile);
    expect(broken.read?.problem).toMatch(/good\.stories\.tsx:1:\d+ does not parse/);
    // the module is served again meanwhile: the index of the last good read stays what the fix is compared with
    patterns.keep(
      moduleId(),
      readStoryFiles(dir, ["./*.stories.tsx"], () => undefined)
    );
    // still broken, in the same place: nothing new to say
    expect(patterns.edited(goodFile)).toEqual({ changed: [], renewed: [] });
    writeFileSync(goodFile, GOOD);
    expect(patterns.edited(goodFile)).toEqual({
      changed: [],
      renewed: [moduleId()],
      read: { file: goodFile }
    });
    writeFileSync(goodFile, "export const = ;\n");
    patterns.edited(goodFile);
    writeFileSync(goodFile, `${GOOD}export const Other = {};\n`);
    expect(patterns.edited(goodFile)).toEqual({
      changed: [moduleId()],
      renewed: [moduleId()],
      read: { file: goodFile }
    });
  });

  it("that fixes a file never read lists its stories", () => {
    const patterns = served();
    writeFileSync(badFile, GOOD);
    expect(patterns.edited(badFile)).toEqual({
      changed: [moduleId()],
      renewed: [moduleId()],
      read: { file: badFile }
    });
  });

  it("says nothing of a file that cannot be had, as an editor writes it anew", () => {
    const patterns = served();
    rmSync(goodFile);
    expect(patterns.edited(goodFile)).toEqual({ changed: [], renewed: [] });
  });

  it("is told to the pages, on the dev server's channel", () => {
    const sent: unknown[] = [];
    const { hotUpdate } = storyFileHotHooks(
      () => true,
      {
        edited: () => ({
          changed: [],
          renewed: ["group"],
          read: { file: "/kit/a.stories.tsx", problem: "broken" }
        }),
        listing: () => ["listing"]
      },
      { follow: () => undefined, isLateReport: () => false }
    );
    if (typeof hotUpdate !== "function") throw new Error("missing hook");
    const renewed: unknown[] = [];
    const environment = {
      name: "client",
      hot: { send: (payload: unknown) => void sent.push(payload) },
      moduleGraph: {
        getModuleById: (id: string) => id,
        invalidateModule: (module: unknown) => void renewed.push(module)
      }
    };
    hotUpdate.call({ environment } as never, { file: "/kit/a.stories.tsx", type: "update" } as never);
    // the next page opened reads the module anew, while the open ones keep their stories
    expect(renewed).toEqual(["group"]);
    expect(sent).toEqual([
      {
        type: "custom",
        event: STORY_FILE_READ_EVENT,
        data: { file: "/kit/a.stories.tsx", problem: "broken" }
      }
    ]);
  });

  it("renews the server's modules for the tools, however the file reads", () => {
    const patterns = served();
    const renewed: unknown[] = [];
    const { hotUpdate } = storyFileHotHooks(() => true, patterns, {
      follow: () => undefined,
      isLateReport: () => false
    });
    if (typeof hotUpdate !== "function") throw new Error("missing hook");
    const environment = {
      name: "ssr",
      moduleGraph: {
        getModuleById: (id: string) => id,
        invalidateModule: (module: unknown) => void renewed.push(module)
      }
    };
    hotUpdate.call({ environment } as never, { file: goodFile, type: "update" } as never);
    expect(renewed).toEqual([moduleId()]);
  });

  it("reloads a page served without the file, and hands the others the news", () => {
    const code = filesModuleHot([{ key: "./a", pattern: "./*", file: "/kit/a.stories.tsx", problem: "x" }]);
    expect(code).toContain("forgebookRefused ??= ");
    expect(code).toContain("window.location.reload()");
    expect(code).toContain("window.dispatchEvent");
  });

  it("reads back what the event says", () => {
    const event = new CustomEvent(STORY_FILE_READ_EVENT, { detail: { file: "/a", problem: "b" } });
    expect(storyFileReadOf(event)).toEqual({ file: "/a", problem: "b" });
    expect(storyFileReadOf(new CustomEvent("other", { detail: { file: "/a" } }))).toEqual({ file: "/a" });
    expect(storyFileReadOf(new CustomEvent("other", { detail: { file: 1 } }))).toBeUndefined();
    expect(storyFileReadOf(new Event("other"))).toBeUndefined();
  });
});

describe("what a bundler's error says", () => {
  /** A parse error as Vite's transform and the build word it. */
  const ParseError = [
    "Transform failed with 1 error:",
    "",
    "[PARSE_ERROR] Expected `}` but found `EOF`",
    "   ╭─[ src/Broken.tsx:1:48 ]",
    "   │",
    " 1 │ export const Broken = () => { return <b>x</b>;",
    "   │                             ┬",
    "───╯",
    "    at transformWithOxc (file:///vite/node.js:1:1)"
  ].join("\n");

  it("takes the place from its code frame and leaves the rest", () => {
    expect(bundlerErrorLines(ParseError)).toEqual(["src/Broken.tsx:1:48: Expected `}` but found `EOF`"]);
  });

  it("keeps a reason that starts as code does", () => {
    expect(bundlerErrorLines("`await` is only allowed here\n   ╭─[ a.ts:1:2 ]")).toEqual([
      "a.ts:1:2: `await` is only allowed here"
    ]);
  });

  it("takes the place from the error, counting columns from 1", () => {
    expect(bundlerErrorLines("Nope", { id: "/a.tsx", loc: { line: 2, column: 4 } })).toEqual([
      "/a.tsx:2:5: Nope"
    ]);
    expect(bundlerErrorLines("Nope", { id: "/a.tsx" })).toEqual(["/a.tsx: Nope"]);
  });

  it("is a line per error for a failed build, without colours or a stack", () => {
    const thrown = Object.assign(new Error("Build failed with 2 errors"), {
      errors: [
        { message: "/a.tsx:1:1 does not parse: X\n/b.tsx:1:1 does not parse: Y", plugin: "forgebook" },
        { message: `\u001b[31m[PARSE_ERROR] \u001b[0m${ParseError}` }
      ]
    });
    expect(buildFailureText(thrown).split("\n")).toEqual([
      "/a.tsx:1:1 does not parse: X",
      "/b.tsx:1:1 does not parse: Y",
      "src/Broken.tsx:1:48: Expected `}` but found `EOF`"
    ]);
    expect(buildFailureText(new Error("Plain"))).toBe("Plain");
    expect(buildFailureText({ errors: [] })).toBe("The build failed");
  });
});

describe("Vite's dependency scan", () => {
  it("goes past a story file that does not parse, and reads any other as it is", () => {
    const [plugin] = scanOptions().plugins as readonly { load: { handler: (id: string) => unknown } }[];
    expect(plugin?.load.handler(badFile)).toEqual({ code: "", moduleType: "js" });
    expect(plugin?.load.handler(goodFile)).toBeNull();
    expect(plugin?.load.handler(join(dir, "virtual.stories.ts"))).toBeNull();
  });
});
