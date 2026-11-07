/**
 * Tests for the story files a catalogue's patterns pass over in hidden folders, and what is said of them.
 *
 * @module
 */
import { globSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { hiddenStoryFolders, hiddenStoryFoldersMessage } from "../src/vite/hiddenStoryFiles.ts";

const made: string[] = [];

/** A catalogue folder with the given files, each empty. */
const folder = (files: readonly string[]): string => {
  const dir = mkdtempSync(join(tmpdir(), "forgebook-hidden-"));
  made.push(dir);
  for (const file of files) {
    mkdirSync(join(dir, file, ".."), { recursive: true });
    writeFileSync(join(dir, file), "");
  }
  return dir;
};

/**
 * Whether this Node's glob skips hidden folders, as Node 24's does: one that enters them (Node 22's) lists those files, so
 * there is nothing to name.
 */
const SKIPS_HIDDEN = ((): boolean => {
  const dir = folder([".probe/x.stories.ts"]);
  return globSync("**/*.stories.ts", { cwd: dir }).length === 0;
})();

afterAll(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

describe.runIf(SKIPS_HIDDEN)("hiddenStoryFolders", () => {
  it("finds the files a pattern would match but for a hidden folder, by folder, and not .git or node_modules", () => {
    const dir = folder([
      "docs/guide/Plain.stories.ts",
      "docs/.vitepress/components/Badge.stories.ts",
      "docs/.vitepress/theme/Layout.stories.ts",
      "docs/.vitepress/theme/notes.md",
      "docs/.Lonely.stories.ts",
      "docs/node_modules/.pkg/Dep.stories.ts",
      ".git/x/Old.stories.ts"
    ]);
    expect(hiddenStoryFolders({ dir, stories: ["./docs/**/*.stories.ts"] })).toEqual([
      {
        folder: "docs/.vitepress",
        pattern: "docs/.vitepress/**/*.stories.ts",
        files: ["docs/.vitepress/components/Badge.stories.ts", "docs/.vitepress/theme/Layout.stories.ts"]
      }
    ]);
  });

  it("finds nothing once a pattern names the folder, or a ! pattern leaves it out", () => {
    const dir = folder(["docs/.vitepress/components/Badge.stories.ts"]);
    expect(
      hiddenStoryFolders({ dir, stories: ["docs/**/*.stories.ts", "docs/.vitepress/**/*.stories.ts"] })
    ).toEqual([]);
    expect(hiddenStoryFolders({ dir, stories: ["docs/**/*.stories.ts", "!docs/.vitepress/**"] })).toEqual([]);
  });

  it("keeps a name with several dots whole in the pattern it advises", () => {
    const dir = folder(["src/.drafts/my.button.stories.tsx"]);
    expect(hiddenStoryFolders({ dir, stories: ["src/**/*.stories.tsx"] })[0]?.pattern).toBe(
      "src/.drafts/**/*.stories.tsx"
    );
  });
});

describe("hiddenStoryFolders where the glob enters hidden folders", () => {
  it.runIf(!SKIPS_HIDDEN)("names nothing, since the patterns list those files", () => {
    const dir = folder(["docs/.vitepress/components/Badge.stories.ts"]);
    expect(hiddenStoryFolders({ dir, stories: ["docs/**/*.stories.ts"] })).toEqual([]);
  });
});

describe("hiddenStoryFoldersMessage", () => {
  it("says how many, the patterns that list them, and how to leave them out", () => {
    expect(
      hiddenStoryFoldersMessage([
        { folder: "docs/.vitepress", pattern: "docs/.vitepress/**/*.stories.ts", files: ["a", "b"] }
      ])
    ).toBe(
      "2 story files sit in a hidden folder the stories' patterns do not enter: list them with `docs/.vitepress/**/*.stories.ts`, or write a `!` pattern for the folder to leave it out"
    );
  });
});
