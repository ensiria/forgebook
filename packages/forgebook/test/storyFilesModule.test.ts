/**
 * Tests for the keys of a pattern's story files: relative to the declaring module, with forward slashes on every
 * system, so a story file has the same key, and its stories the same ids, on Windows as on macOS and Linux.
 *
 * @module
 */
import { posix, win32 } from "node:path";

import { describe, expect, it } from "vitest";

import { storyFileKey } from "../src/vite/storyFilesModule.ts";
import { vitePathsOf } from "../src/vite/vitePaths.ts";

describe("storyFileKey", () => {
  it("writes a file Windows' glob gives with backslashes with forward slashes, from `./` or `../`", () => {
    const windows = vitePathsOf(win32);
    expect(storyFileKey("C:/Users/ada/kit", "src\\a\\A.stories.tsx", windows)).toBe("./src/a/A.stories.tsx");
    expect(storyFileKey("C:/Users/ada/kit/forgebook", "..\\src\\A.stories.tsx", windows)).toBe(
      "../src/A.stories.tsx"
    );
  });

  it("gives the same keys on POSIX", () => {
    const posixPaths = vitePathsOf(posix);
    expect(storyFileKey("/srv/kit", "src/a/A.stories.tsx", posixPaths)).toBe("./src/a/A.stories.tsx");
    expect(storyFileKey("/srv/kit/forgebook", "../src/A.stories.tsx", posixPaths)).toBe(
      "../src/A.stories.tsx"
    );
  });
});
