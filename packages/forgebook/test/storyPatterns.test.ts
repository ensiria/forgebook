/**
 * Which files a list of patterns lists: the union of its patterns less what its `!` ones match, whatever their order,
 * each file once and with the first pattern that lists it; and a group of such patterns written in a module's id.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path, { dirname, join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { storyFilesGroupOf, storyFilesGroupText } from "../src/vite/storyFilesModule.ts";
import { isNegated, listedFiles, patternsProblem } from "../src/vite/storyPatterns.ts";
import { vitePathsOf } from "../src/vite/vitePaths.ts";

const ROOT = mkdtempSync(join(tmpdir(), "forgebook-story-patterns-"));

for (const file of [
  "app/forgebook.config.ts",
  "src/Button.stories.tsx",
  "src/next/Button.stories.tsx",
  "src/next/deep/Menu.stories.tsx",
  "src/legacy/Old.stories.tsx",
  "src/Pagination-story.tsx"
]) {
  mkdirSync(dirname(join(ROOT, file)), { recursive: true });
  writeFileSync(join(ROOT, file), "");
}

afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

describe("listedFiles", () => {
  it("leaves out what a `!` pattern matches, from every pattern's files", () => {
    expect(
      listedFiles(ROOT, ["src/**/*.stories.tsx", "src/*-story.tsx", "!src/legacy/*", "!src/*-story.tsx"])
    ).toEqual([
      { key: "./src/Button.stories.tsx", pattern: "src/**/*.stories.tsx" },
      { key: "./src/next/Button.stories.tsx", pattern: "src/**/*.stories.tsx" },
      { key: "./src/next/deep/Menu.stories.tsx", pattern: "src/**/*.stories.tsx" }
    ]);
  });

  it("leaves out every file of a folder a `!` pattern names, as fast-glob does", () => {
    for (const folder of ["!src/next", "!src/next/", "!src/*xt"])
      expect(listedFiles(ROOT, ["src/**/*.stories.tsx", folder]).map((file) => file.key)).toEqual([
        "./src/Button.stories.tsx",
        "./src/legacy/Old.stories.tsx"
      ]);
  });

  it("applies a `!` pattern whatever its place in the list, first or last", () => {
    const last = listedFiles(ROOT, ["src/**/*.stories.tsx", "!src/**/next/**"]);
    const first = listedFiles(ROOT, ["!src/**/next/**", "src/**/*.stories.tsx"]);
    expect(first).toEqual(last);
    expect(last.map((file) => file.key)).toEqual([
      "./src/Button.stories.tsx",
      "./src/legacy/Old.stories.tsx"
    ]);
  });

  it("lists a file two patterns match once, with the first pattern, whose start begins its title", () => {
    const listed = listedFiles(ROOT, ["src/**/next/*.stories.tsx", "src/**/*.stories.tsx"]);
    expect(listed.map((file) => file.key)).toEqual([
      "./src/Button.stories.tsx",
      "./src/legacy/Old.stories.tsx",
      "./src/next/Button.stories.tsx",
      "./src/next/deep/Menu.stories.tsx"
    ]);
    expect(listed.find((file) => file.key === "./src/next/Button.stories.tsx")?.pattern).toBe(
      "src/**/next/*.stories.tsx"
    );
  });

  it("reads `!` patterns from the same folder as the others, climbing out of it the same way", () => {
    const app = join(ROOT, "app");
    expect(
      listedFiles(app, ["../src/**/*.stories.tsx", "!../src/**/next/**", "!../src/legacy/Old.stories.tsx"])
    ).toEqual([{ key: "../src/Button.stories.tsx", pattern: "../src/**/*.stories.tsx" }]);
    // relative to the folder: `**` does not climb out of it
    expect(listedFiles(app, ["../src/*.stories.tsx", "!**/Button.stories.tsx"])).toHaveLength(1);
  });

  it("reads an extglob's `!(…)` as a pattern that lists files, not one that leaves them out", () => {
    expect(isNegated("!(legacy)/*.stories.tsx")).toBe(false);
    expect(isNegated("!src/legacy/*")).toBe(true);
    expect(listedFiles(join(ROOT, "src"), ["!(legacy)/*.stories.tsx"]).map((file) => file.key)).toEqual([
      "./next/Button.stories.tsx"
    ]);
  });

  it("keys Windows paths with forward slashes, so a `!` pattern meets them and a file is listed once", () => {
    const found: Readonly<Record<string, readonly string[]>> = {
      "src/**/*.stories.tsx": ["src\\Button.stories.tsx", "src\\legacy\\Old.stories.tsx"],
      "src/Button.stories.tsx": ["src\\Button.stories.tsx"],
      "src/legacy/*": ["src\\legacy\\Old.stories.tsx"]
    };
    const listed = listedFiles(
      "C:\\app",
      ["src/**/*.stories.tsx", "src/Button.stories.tsx", "!src/legacy/*"],
      (_root, pattern) => found[pattern] ?? [],
      vitePathsOf(path.win32)
    );
    expect(listed).toEqual([{ key: "./src/Button.stories.tsx", pattern: "src/**/*.stories.tsx" }]);
  });

  it("never walks the dependencies for a `!` pattern that names them when no listing pattern does", () => {
    const walked: string[] = [];
    listedFiles(ROOT, ["src/**/*.stories.tsx", "!**/node_modules/**", "!src/legacy/*"], (_root, pattern) => {
      walked.push(pattern);
      return [];
    });
    expect(walked).toEqual(["src/legacy/*", "src/**/*.stories.tsx"]);
  });

  it("refuses a list of `!` patterns alone, which lists nothing", () => {
    expect(() => listedFiles(ROOT, ["!src/legacy/*"])).toThrow(/every pattern is a `!` one/);
    expect(patternsProblem(["!src/legacy/*", "!src/next/**"])).toContain('("!src/legacy/*", "!src/next/**")');
    expect(patternsProblem(["src/**/*.stories.tsx", "!src/legacy/*"])).toBeUndefined();
    expect(patternsProblem([])).toBeUndefined();
  });
});

describe("a group's patterns in a module's id", () => {
  it("writes and reads back every pattern, its `!` with its count of climbed folders, never a `..`", () => {
    const patterns = [
      "../src/**/*.stories.tsx",
      "!../src/**/next/*",
      "./kit/*.stories.tsx",
      "!(legacy)/*.tsx"
    ];
    const text = storyFilesGroupText("/repo/app", patterns);
    expect(text.split(/[/:]/)).not.toContain("..");
    expect(storyFilesGroupOf(text)).toEqual({
      root: "/repo/app",
      patterns: ["../src/**/*.stories.tsx", "!../src/**/next/*", "kit/*.stories.tsx", "!(legacy)/*.tsx"]
    });
  });

  it("writes one pattern as before", () => {
    expect(storyFilesGroupText("/repo/app", ["../src/*.stories.tsx"])).toBe(
      "/repo/app::1::src/*.stories.tsx"
    );
  });
});
