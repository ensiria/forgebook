/**
 * Tests for a group's index as its module writes it: a large group's stories as rows, a small one's as objects, read
 * back the same either way.
 *
 * @module
 */

import { runInNewContext } from "node:vm";

import type { StoryFileIndex } from "@forgebook/story-format/source";
import { describe, expect, it } from "vitest";

import { type IndexedStoryFile, storyFilesCode } from "../src/vite/storyFilesModule.ts";

/** A file whose stories have different keys, one with a key in the middle the other lacks. */
const BUTTON: StoryFileIndex = {
  title: "Inputs/Button",
  stories: [
    { exportName: "Primary", description: "The main action.", hasPlay: true },
    { exportName: "Quiet", height: 120 },
    { exportName: "Plain" }
  ]
};

/** A second file, whose story has a key the first file's do not. */
const BADGE: StoryFileIndex = { title: "Data/Badge", stories: [{ exportName: "Count", isMain: true }] };

/**
 * The index the generated module's default holds, by file.
 *
 * @param files - the files indexed.
 */
const readIndex = (files: readonly IndexedStoryFile[]): unknown => {
  const code = storyFilesCode("/repo", ["./src/*.stories.tsx"], files, { hasUsage: false, hasReach: false });
  // the loaders are never called here: `import()` stays unevaluated inside their arrows
  const body = code.replace("export default {", "result = {");
  const context: { result?: { index?: unknown } } = {};
  runInNewContext(body, context);
  return JSON.parse(JSON.stringify(context.result?.index));
};

/**
 * A group of story files of the same shape, as many as asked.
 *
 * @param count - how many files.
 */
const manyFiles = (count: number): IndexedStoryFile[] =>
  Array.from({ length: count }, (_, at) => ({
    key: `./src/W${at}.stories.tsx`,
    pattern: "./src/*.stories.tsx",
    file: `/repo/src/W${at}.stories.tsx`,
    index: {
      title: `Group/W${at}`,
      stories: Array.from({ length: 5 }, (_, story) => ({
        exportName: `Story${story}`,
        description: `W${at} story ${story}.`,
        ...(story === 4 ? { hasPlay: true } : {})
      }))
    }
  }));

describe("storyFilesCode", () => {
  it("reads back the objects either way, leaving out the keys a story lacks", () => {
    const files: IndexedStoryFile[] = [
      {
        key: "./src/Button.stories.tsx",
        pattern: "./src/*.stories.tsx",
        file: "/repo/src/Button.stories.tsx",
        index: BUTTON
      },
      {
        key: "./src/Badge.stories.tsx",
        pattern: "./src/*.stories.tsx",
        file: "/repo/src/Badge.stories.tsx",
        index: BADGE
      }
    ];
    expect(readIndex(files)).toEqual({
      "./src/Button.stories.tsx": BUTTON,
      "./src/Badge.stories.tsx": BADGE
    });
    const many = manyFiles(100);
    expect(readIndex(many)).toEqual(Object.fromEntries(many.map(({ key, index }) => [key, index])));
  });

  it("writes a large group's stories as rows, each key once, and a small group's as objects", () => {
    const code = (files: readonly IndexedStoryFile[]): string =>
      storyFilesCode("/repo", ["./src/*.stories.tsx"], files, { hasUsage: false, hasReach: false });
    expect(code(manyFiles(100)).match(/"exportName"/g)).toHaveLength(1);
    expect(code(manyFiles(2)).match(/"exportName"/g)).toHaveLength(10);
  });
});
