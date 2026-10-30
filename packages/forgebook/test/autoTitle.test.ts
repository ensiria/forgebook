/**
 * Tests for the title a story file's path makes.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { autoTitle, patternBase, STORY_FILE } from "../src/vite/autoTitle.ts";

describe("patternBase", () => {
  it("keeps the folders before the first glob", () => {
    expect(patternBase("../src/**/*.stories.tsx")).toBe("../src");
    expect(patternBase("src/components/*.stories.@(js|jsx)")).toBe("src/components");
    expect(patternBase("./Button.stories.tsx")).toBe(".");
  });
});

describe("autoTitle", () => {
  it("makes the path from the pattern's base, without .stories.*", () => {
    expect(autoTitle("../src", "../src/inputs/Select.stories.tsx")).toBe("inputs/Select");
  });

  it("joins a file named as its folder, and an index file, into the folder", () => {
    expect(autoTitle("src", "src/inputs/Select/Select.stories.jsx")).toBe("inputs/Select");
    expect(autoTitle("src", "src/inputs/select/Select.stories.ts")).toBe("inputs/select");
    expect(autoTitle("src", "src/inputs/Select/index.stories.mjs")).toBe("inputs/Select");
  });

  it("gives none when the path gives no segment", () => {
    expect(autoTitle("src", "src/index.stories.tsx")).toBeUndefined();
  });
});

describe("STORY_FILE", () => {
  it("matches the JavaScript and TypeScript story files", () => {
    for (const file of ["a.stories.ts", "a.stories.tsx", "a.stories.js", "a.stories.jsx", "a.stories.mjs"])
      expect(STORY_FILE.test(file)).toBe(true);
    expect(STORY_FILE.test("a.stories.mdx")).toBe(false);
  });
});
